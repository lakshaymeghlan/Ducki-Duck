// ducki-duck desktop shell.
//
// The "pet" window is a small, transparent, frameless, always-on-top duck you
// can drag anywhere. A system-tray menu lets you show/hide the duck, open the
// full agenda window, toggle launch-at-login, and quit. The agenda window is
// created on demand so the app stays a lightweight floating pet by default.

use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Global cursor position in screen points (top-left origin). Lets the dog's
/// eyes track the pointer anywhere on screen, not just over its own window.
#[tauri::command]
fn global_cursor() -> (f64, f64) {
    #[cfg(target_os = "macos")]
    {
        use core_graphics::event::CGEvent;
        use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
        if let Ok(src) = CGEventSource::new(CGEventSourceStateID::CombinedSessionState) {
            if let Ok(ev) = CGEvent::new(src) {
                let p = ev.location();
                return (p.x, p.y);
            }
        }
    }
    (0.0, 0.0)
}

/// macOS: pin a window so it floats on every Space and stays visible over
/// fullscreen apps. Sets the NSWindow collection behavior + a high level,
/// which the cross-platform Tauri helpers don't fully cover.
#[cfg(target_os = "macos")]
fn pin_over_everything(window: &tauri::WebviewWindow) {
    use objc::runtime::Object;
    use objc::{msg_send, sel, sel_impl};
    if let Ok(ptr) = window.ns_window() {
        let ns = ptr as *mut Object;
        // canJoinAllSpaces (1<<0) | stationary (1<<4) | fullScreenAuxiliary (1<<8)
        let behavior: u64 = (1 << 0) | (1 << 4) | (1 << 8);
        // NSStatusWindowLevel keeps it above normal windows.
        let level: i64 = 25;
        unsafe {
            let _: () = msg_send![ns, setCollectionBehavior: behavior];
            let _: () = msg_send![ns, setLevel: level];
        }
    }
}

/// Park the duck in the bottom-right corner of the primary monitor, leaving a
/// margin so it clears the dock. Called on launch so it always shows up in the
/// same sticky spot.
fn pin_to_corner(window: &tauri::WebviewWindow) {
    let monitor = match window.primary_monitor() {
        Ok(Some(m)) => m,
        _ => return,
    };
    let msize = monitor.size();
    let mpos = monitor.position();
    let wsize = match window.outer_size() {
        Ok(s) => s,
        _ => return,
    };
    let scale = monitor.scale_factor();
    let margin_x = (24.0 * scale) as i32;
    let margin_y = (96.0 * scale) as i32; // clear the dock

    let x = mpos.x + msize.width as i32 - wsize.width as i32 - margin_x;
    let y = mpos.y + msize.height as i32 - wsize.height as i32 - margin_y;
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

/// Toggle the floating duck window's visibility.
fn toggle_pet(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("pet") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Open (or focus, if already open) the full agenda window.
fn open_agenda(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("agenda") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "agenda", WebviewUrl::App("index.html".into()))
        .title("doggy-dog — agenda")
        .inner_size(920.0, 760.0)
        .min_inner_size(360.0, 480.0)
        .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        // Remember where the user dropped the dog between launches.
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![global_cursor])
        .setup(|app| {
            // Pinned + visible on every Space and above fullscreen apps.
            if let Some(pet) = app.get_webview_window("pet") {
                let _ = pet.set_visible_on_all_workspaces(true);
                let _ = pet.set_always_on_top(true);
                #[cfg(target_os = "macos")]
                pin_over_everything(&pet);
                pin_to_corner(&pet);
            }

            // Global keystroke *timing* for the typing companion: emit an event
            // on each key press. We never inspect or store which key it is — only
            // that a key was pressed and when. Needs macOS Input Monitoring
            // permission; without it this silently receives nothing.
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let _ = rdev::listen(move |event| {
                        if matches!(event.event_type, rdev::EventType::KeyPress(_)) {
                            let _ = handle.emit("global-keypress", ());
                        }
                    });
                });
            }

            let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);

            let show_hide =
                MenuItemBuilder::with_id("show_hide", "Show / hide duck").build(app)?;
            let agenda = MenuItemBuilder::with_id("agenda", "Open agenda…").build(app)?;
            let autostart = CheckMenuItemBuilder::with_id("autostart", "Launch at login")
                .checked(autostart_on)
                .build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit ducki-duck").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_hide)
                .item(&agenda)
                .separator()
                .item(&autostart)
                .separator()
                .item(&quit)
                .build()?;

            // Keep a handle to the check item so we can sync its tick.
            let autostart_item = autostart.clone();

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("ducki-duck")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show_hide" => toggle_pet(app),
                    "agenda" => open_agenda(app),
                    "autostart" => {
                        let mgr = app.autolaunch();
                        let now_enabled = if mgr.is_enabled().unwrap_or(false) {
                            let _ = mgr.disable();
                            false
                        } else {
                            let _ = mgr.enable();
                            true
                        };
                        let _ = autostart_item.set_checked(now_enabled);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click the tray icon to toggle the duck quickly.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_pet(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the floating duck just hides it (tray Quit exits the app).
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "pet" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ducki-duck");
}
