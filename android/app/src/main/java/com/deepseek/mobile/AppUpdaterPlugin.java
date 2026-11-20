package com.deepseek.mobile;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app updater bridge.
 *
 * The APK is downloaded **natively** (the WebView cannot fetch GitHub release
 * assets because the redirect target sends no CORS headers), then handed to the
 * system package installer through a FileProvider URI. Progress is reported back
 * to JS via the "progress" listener.
 *
 * Android never replaces a running app silently: the installer shows its own
 * confirmation screen. A MY_PACKAGE_REPLACED receiver
 * ({@link PackageReplacedReceiver}) tries to bring the fresh build back up.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private File cacheDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) {
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
        }
        return dir;
    }

    /** True when Android lets this app hand APKs to the installer. */
    private boolean canInstallPackages() {
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void openUnknownSourcesSettings() {
        try {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            settings.setData(Uri.parse("package:" + getContext().getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
        } catch (Exception ignored) {
            // The install intent itself will show the system dialog as a fallback.
        }
    }

    private void launchInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    /** Download the APK with progress events, then open the installer. */
    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        final String fileName = call.getString("fileName", "update.apk");
        if (url == null || url.isEmpty()) {
            call.reject("缺少下载地址");
            return;
        }
        if (!canInstallPackages()) {
            openUnknownSourcesSettings();
            call.reject("请先允许「安装未知来源的应用」，再重试更新");
            return;
        }

        final String safeName = fileName.replace("/", "_").replace("\\", "_");
        new Thread(() -> {
            FileOutputStream out = null;
            InputStream input = null;
            try {
                File apk = new File(cacheDir(), safeName);
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(60000);
                connection.setRequestProperty("User-Agent", "DeepseekAPP-Android");
                connection.connect();

                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) {
                    call.reject("下载失败：HTTP " + code);
                    return;
                }
                long total = connection.getContentLengthLong();
                input = connection.getInputStream();
                out = new FileOutputStream(apk);
                byte[] buffer = new byte[128 * 1024];
                long received = 0;
                long lastNotify = 0;
                int read;
                while ((read = input.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                    received += read;
                    long now = System.currentTimeMillis();
                    if (now - lastNotify > 150) {
                        lastNotify = now;
                        JSObject progress = new JSObject();
                        progress.put("received", received);
                        progress.put("total", total);
                        progress.put("progress", total > 0 ? (double) received / (double) total : 0);
                        notifyListeners("progress", progress);
                    }
                }
                out.flush();
                out.close();
                out = null;
                input.close();
                input = null;

                if (total > 0 && received != total) {
                    call.reject("下载不完整，请重试");
                    return;
                }

                JSObject done = new JSObject();
                done.put("received", received);
                done.put("total", total);
                done.put("progress", 1.0);
                notifyListeners("progress", done);

                launchInstaller(apk);

                JSObject result = new JSObject();
                result.put("path", apk.getAbsolutePath());
                result.put("size", received);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("下载失败：" + error.getMessage());
            } finally {
                try {
                    if (out != null) out.close();
                } catch (Exception ignored) {
                }
                try {
                    if (input != null) input.close();
                } catch (Exception ignored) {
                }
            }
        }).start();
    }

    /** Fallback: install bytes that JS already holds (base64). */
    @PluginMethod
    public void install(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName", "update.apk");
        if (base64 == null || base64.isEmpty()) {
            call.reject("安装包数据为空");
            return;
        }
        if (!canInstallPackages()) {
            openUnknownSourcesSettings();
            call.reject("请先允许「安装未知来源的应用」，再重试更新");
            return;
        }
        try {
            File apk = new File(cacheDir(), fileName);
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            FileOutputStream out = new FileOutputStream(apk);
            out.write(bytes);
            out.flush();
            out.close();
            launchInstaller(apk);

            JSObject result = new JSObject();
            result.put("path", apk.getAbsolutePath());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("拉起安装器失败：" + error.getMessage());
        }
    }
}
