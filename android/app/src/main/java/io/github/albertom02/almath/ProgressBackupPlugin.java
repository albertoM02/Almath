package io.github.albertom02.almath;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Uses the system document picker; needs no broad storage permissions. */
@CapacitorPlugin(name = "ProgressBackup")
public class ProgressBackupPlugin extends Plugin {
    private static final int MAX_BYTES = 12 * 1024 * 1024;

    @Override
    protected Bundle saveInstanceState() {
        // A backup can exceed Android's activity-state Binder limit. If the OS
        // kills the app while its picker is open, the user can retry the export;
        // never serialize the large encrypted payload into saved activity state.
        return null;
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data");
        String filename = call.getString("filename");
        if (data == null || filename == null ||
            !filename.matches("Almath-progress-\\d{4}-\\d{2}-\\d{2}\\.almathbackup") ||
            data.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            call.reject("Invalid backup file.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        try {
            startActivityForResult(call, intent, "backupCreated");
        } catch (Exception error) {
            call.reject("The system file picker is unavailable.");
        }
    }

    @ActivityCallback
    private void backupCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            String data = call.getString("data");
            if (data == null) { call.reject("Backup data is unavailable."); return; }
            byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) { call.reject("Backup file is too large."); return; }
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new java.io.IOException();
                stream.write(bytes);
                stream.flush();
            } catch (Exception error) {
                call.reject("The encrypted backup could not be saved.");
                return;
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void selectFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        try {
            startActivityForResult(call, intent, "backupSelected");
        } catch (Exception error) {
            call.reject("The system file picker is unavailable.");
        }
    }

    @ActivityCallback
    private void backupSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject();
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        getBridge().execute(() -> {
            try (InputStream stream = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (stream == null) throw new java.io.IOException();
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (output.size() + count > MAX_BYTES) {
                        call.reject("Backup file is too large.");
                        return;
                    }
                    output.write(buffer, 0, count);
                }
                String name = "Almath backup";
                try (Cursor cursor = getContext().getContentResolver().query(
                        uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        String display = cursor.getString(0);
                        if (display != null) name = display.substring(0, Math.min(256, display.length()));
                    }
                }
                JSObject response = new JSObject();
                response.put("data", output.toString(StandardCharsets.UTF_8.name()));
                response.put("name", name);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("The backup file could not be opened.");
            }
        });
    }
}
