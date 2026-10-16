package org.schada.app;

import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private boolean isAppReady = false;
    private int lastTopDp = 0;
    private int lastBottomDp = 0;
    private int lastLeftDp = 0;
    private int lastRightDp = 0;

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

        // Initialize fallback status bar height immediately from Android resources
        lastTopDp = getStatusBarHeightFromResources();

        // Enable edge-to-edge window decor layout
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        super.onCreate(savedInstanceState);

        // Setup authoritative window insets listener
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets navInsets = windowInsets.getInsets(
                WindowInsetsCompat.Type.navigationBars()
            );

            float density = getResources().getDisplayMetrics().density;
            if (density > 0) {
                if (insets.top > 0) {
                    lastTopDp = Math.round(insets.top / density);
                }
                lastBottomDp = Math.round(navInsets.bottom / density);
                lastLeftDp = Math.round(insets.left / density);
                lastRightDp = Math.round(insets.right / density);
            }

            applySafeAreaInsetsToWebView();
            return windowInsets;
        });

        // Register NativeSplash bridge so React/Web can signal when ready and query insets
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void notifyAppReady() {
                    runOnUiThread(() -> {
                        isAppReady = true;
                        applySafeAreaInsetsToWebView();
                    });
                }

                @JavascriptInterface
                public int getStatusBarHeight() {
                    return lastTopDp;
                }

                @JavascriptInterface
                public int getNavigationBarHeight() {
                    return lastBottomDp;
                }
            }, "NativeSplash");

            // Safety timeout in case web assets fail or delay in invoking the bridge
            getBridge().getWebView().postDelayed(() -> {
                isAppReady = true;
                applySafeAreaInsetsToWebView();
            }, 3000);
        }
    }

    private int getStatusBarHeightFromResources() {
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            float density = getResources().getDisplayMetrics().density;
            if (density > 0) {
                return Math.round(getResources().getDimensionPixelSize(resourceId) / density);
            }
        }
        return 38; // standard Android status bar fallback dp
    }

    private void applySafeAreaInsetsToWebView() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            String js = String.format(
                Locale.US,
                "try {" +
                "  document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-top', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-bottom', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-left', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');" +
                "  document.documentElement.style.setProperty('--safe-right', '%dpx');" +
                "} catch (e) { console.error('Safe area injection error:', e); }",
                lastTopDp, lastTopDp,
                lastBottomDp, lastBottomDp,
                lastLeftDp, lastLeftDp,
                lastRightDp, lastRightDp
            );
            getBridge().getWebView().evaluateJavascript(js, null);
        }
    }
}
