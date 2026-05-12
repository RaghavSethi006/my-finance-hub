mod backend;

use backend::{
  delete_vault_document,
  export_encrypted_backup,
  get_desktop_paths,
  get_security_status,
  import_encrypted_backup,
  import_vault_document,
  initialize_app_state,
  lock_app,
  lock_vault,
  log_frontend_event,
  load_app_state,
  record_security_activity,
  read_vault_document,
  replace_app_state,
  set_app_pin,
  set_auto_lock_timeout,
  set_vault_password,
  unlock_app,
  unlock_vault,
};
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
      delete_vault_document,
      read_vault_document,
      export_encrypted_backup,
      import_encrypted_backup,
      get_desktop_paths,
      log_frontend_event,
      get_security_status,
      record_security_activity,
      lock_app,
      unlock_app,
      set_app_pin,
      lock_vault,
      unlock_vault,
      set_vault_password,
      set_auto_lock_timeout
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
