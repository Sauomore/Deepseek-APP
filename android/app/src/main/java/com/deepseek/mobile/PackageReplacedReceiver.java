package com.deepseek.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Brings the app back to the foreground right after an in-app update replaces
 * the package. Android may still block the background activity start on some
 * versions; the installer's "打开" button is the fallback UX.
 */
public class PackageReplacedReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launch.putExtra("fromUpdate", true);
            try {
                context.startActivity(launch);
            } catch (Exception ignored) {
                // Background activity starts can be blocked; the user can reopen manually.
            }
        }
    }
}
