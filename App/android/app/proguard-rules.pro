# Razorpay checkout.
#
# The SDK resolves its payment classes reflectively and communicates with the
# checkout WebView through @JavascriptInterface methods, so R8 cannot see the
# call sites and strips them — the sheet then opens blank or crashes on submit.
# Inert while minification is off; required the moment it is turned on.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }

# Razorpay reads these from the annotation at runtime.
-optimizations !method/inlining/*
-keepclasseswithmembers class * {
  public void onPayment*(...);
}
