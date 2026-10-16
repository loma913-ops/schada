package org.schada.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isAppReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> !isAppReady);

        splashScreen.setOnExitAnimationListener(splashScreenView -> {
            splashScreenView.getView().animate()
                .alpha(0f)
                .setDuration(250L)
                .withEndAction(splashScreenView::remove)
                .start();
        });

        super.onCreate(savedInstanceState);

        // Register NativeSplash bridge so React/Web can signal when the first frame is rendered
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void notifyAppReady() {
                    runOnUiThread(() -> isAppReady = true);
                }
            }, "NativeSplash");

            // Safety timeout in case web assets fail or delay in invoking the bridge
            getBridge().getWebView().postDelayed(() -> isAppReady = true, 3000);
        }
    }
}
