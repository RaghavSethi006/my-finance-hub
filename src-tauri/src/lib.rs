mod backend;

use backend::{delete_vault_document, import_vault_document, initialize_app_state, load_app_state, replace_app_state};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let state = initialize_app_state(&app.handle())?;
      app.manage(state);
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      load_app_state,
      replace_app_state,
      import_vault_document,
      delete_vault_document
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
