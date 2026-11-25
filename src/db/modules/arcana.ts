import { queryRun } from '../core';
import type { ArcanaLink } from '../types';

export type { ArcanaLink };

export async function saveArcanaLinks(links: ArcanaLink[]) {
  await queryRun('DELETE FROM arcana_links');
  for (const l of links) {
    await queryRun(
      `INSERT INTO arcana_links (id, title, description, url, icon, sortorder)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         url = EXCLUDED.url,
         icon = EXCLUDED.icon,
         sortorder = EXCLUDED.sortorder`,
      [l.id, l.title, l.description, l.url, l.icon, l.sortOrder]
    );
  }
}

export async function saveArcanaConfig(config: any) {
  await queryRun(
    `INSERT INTO arcana_config (id, config_json)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
    ['default', JSON.stringify(config)]
  );
}
