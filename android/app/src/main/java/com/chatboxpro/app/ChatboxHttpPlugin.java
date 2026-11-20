package com.chatboxpro.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PermissionState;



import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 直连 HTTP 插件：
 * - 绕开 WebView 的跨域限制（原生请求不受 CORS 约束）
 * - stream：把 SSE 逐行推给 JS，保持流式输出体验
 * - json：普通请求，返回状态码与响应体
 * - upload：multipart 上传（文件解析用）
 */
@CapacitorPlugin(name = "ChatboxHttp")
public class ChatboxHttpPlugin extends Plugin {

    private final ConcurrentHashMap<String, HttpURLConnection> active = new ConcurrentHashMap<>();

    @PluginMethod
    public void stream(PluginCall call) {
        String url = call.getString("url");
        String apiKey = call.getString("apiKey", "");
        String body = call.getString("body", "{}");
        String requestId = call.getString("requestId", String.valueOf(System.nanoTime()));

        if (url == null) {
            call.reject("missing url");
            return;
        }

        call.setKeepAlive(true);

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                active.put(requestId, conn);
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(300000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "text/event-stream");
                if (!apiKey.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                }

                byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload);
                }

                int status = conn.getResponseCode();
                if (status >= 400) {
                    String err = readAll(conn.getErrorStream());
                    JSObject ret = new JSObject();
                    ret.put("status", status);
                    ret.put("body", err);
                    call.resolve(ret);
                    return;
                }

                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isEmpty()) continue;
                    final String lineCopy = line;
                    postToUi(() -> {
                        JSObject chunk = new JSObject();
                        chunk.put("line", lineCopy);
                        chunk.put("requestId", requestId);
                        notifyListeners("chunk", chunk);
                    });
                    if (line.contains("[DONE]")) break;
                }

                postToUi(() -> {
                    JSObject done = new JSObject();
                    done.put("requestId", requestId);
                    notifyListeners("done", done);
                });

                JSObject ret = new JSObject();
                ret.put("status", status);
                call.resolve(ret);
            } catch (Exception e) {
                final String msg = String.valueOf(e.getMessage());
                appendLine("stream error: " + msg);
                postToUi(() -> {
                    JSObject err = new JSObject();
                    err.put("requestId", requestId);
                    err.put("message", msg);
                    notifyListeners("error", err);
                });
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                active.remove(requestId);
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestId = call.getString("requestId");
        if (requestId != null) {
            HttpURLConnection conn = active.remove(requestId);
            if (conn != null) conn.disconnect();
        }
        call.resolve();
    }

    @PluginMethod
    public void json(PluginCall call) {
        String url = call.getString("url");
        String method = call.getString("method", "GET");
        String apiKey = call.getString("apiKey", "");
        String body = call.getString("body", null);

        if (url == null) {
            call.reject("missing url");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(120000);
                conn.setRequestProperty("Accept", "application/json");
                if (!apiKey.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                }
                if (body != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }

                int status = conn.getResponseCode();
                InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String text = readAll(is);

                JSObject ret = new JSObject();
                ret.put("status", status);
                ret.put("body", text);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    /** 用系统浏览器打开链接（下载 APK、打开邮箱等） */
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("missing url");
            return;
        }
        try {
            android.content.Intent intent = new android.content.Intent(
                    android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void upload(PluginCall call) {
        String url = call.getString("url");
        String apiKey = call.getString("apiKey", "");
        String filename = call.getString("filename", "file");
        String purpose = call.getString("purpose", "text_recognition");
        String base64 = call.getString("data");

        if (url == null || base64 == null) {
            call.reject("missing url or data");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                String boundary = "----chatboxpro" + System.currentTimeMillis();
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(300000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                if (!apiKey.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                }

                byte[] fileBytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);

                String head = "--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"purpose\"\r\n\r\n"
                        + purpose + "\r\n"
                        + "--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                        + "Content-Type: application/octet-stream\r\n\r\n";
                String tail = "\r\n--" + boundary + "--\r\n";

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(head.getBytes(StandardCharsets.UTF_8));
                    os.write(fileBytes);
                    os.write(tail.getBytes(StandardCharsets.UTF_8));
                }

                int status = conn.getResponseCode();
                InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                String text = readAll(is);

                JSObject ret = new JSObject();
                ret.put("status", status);
                ret.put("body", text);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject(String.valueOf(e.getMessage()));
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void appendLog(PluginCall call) {
        String line = call.getString("line", "");
        appendLine(line);
        call.resolve();
    }

    private void postToUi(Runnable r) {
        try {
            getActivity().runOnUiThread(r);
        } catch (Exception e) {
            r.run();
        }
    }

    private void appendLine(String line) {
        try {
            java.io.File f = new java.io.File(getContext().getFilesDir(), "crash.log");
            String stamp = new java.text.SimpleDateFormat("MM-dd HH:mm:ss").format(new java.util.Date());
            java.io.FileWriter w = new java.io.FileWriter(f, true);
            w.write("[" + stamp + "] " + line + "\n");
            w.close();
        } catch (Exception ignored) {
        }
    }

    private String readAll(InputStream is) {
        if (is == null) return "";
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return bos.toString("UTF-8");
        } catch (Exception e) {
            return "";
        } finally {
            try {
                is.close();
            } catch (Exception ignored) {
            }
        }
    }
}
