// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
extern "system" {
    fn GetCurrentProcess() -> isize;
    fn SetProcessWorkingSetSize(process: isize, min: usize, max: usize) -> i32;
    fn K32EmptyWorkingSet(process: isize) -> i32;
}

fn main() {
    // Windows WebView2 RAM Optimizer: Cap cache & memory limit to ~100MB
    #[cfg(target_os = "windows")]
    {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion \
             --disk-cache-size=16777216 \
             --media-cache-size=16777216 \
             --js-flags=--max-old-space-size=96 \
             --renderer-process-limit=1 \
             --enable-low-end-device-mode \
             --disable-gpu-shader-disk-cache \
             --disable-background-networking \
             --disable-component-update \
             --disable-default-apps \
             --disable-extensions \
             --disable-sync"
        );

        // Periodic background memory trimmer for Windows
        std::thread::spawn(|| {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(30));
                unsafe {
                    let proc = GetCurrentProcess();
                    K32EmptyWorkingSet(proc);
                    SetProcessWorkingSetSize(proc, usize::MAX, usize::MAX);
                }
            }
        });
    }

    snutify_lib::run()
}
