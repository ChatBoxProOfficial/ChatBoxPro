package com.chatboxpro.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册直连插件（必须在 super.onCreate 之前）
        registerPlugin(ChatboxHttpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
