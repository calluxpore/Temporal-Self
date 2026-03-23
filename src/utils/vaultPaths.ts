/** Root folder inside the user's Obsidian vault (or any chosen directory). */
export const VAULT_APP_DIR = 'Temporal-Self';

export const vaultRelative = {
  memories: `${VAULT_APP_DIR}/memories`,
  attachments: `${VAULT_APP_DIR}/attachments`,
  groupsJson: `${VAULT_APP_DIR}/groups.json`,
  settingsJson: `${VAULT_APP_DIR}/settings.json`,
  readme: `${VAULT_APP_DIR}/README.md`,
} as const;
