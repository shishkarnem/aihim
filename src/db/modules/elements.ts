import { queryGet, queryRun } from '../core';
import type { UserElement } from '../types';

export type { UserElement };

export async function seedBasicElementsForUser(userId: string) {
  const basicElements = [
    { name: 'Вода', icon: '💧', description: 'Жидкость жизни, адаптируемая и настойчивая. Она течет по венам мира.', rarity: 'Обычный', type: 'Материя', state: 'Жидкое', temperature: 20, targetTemperature: 22, stability: 90, essences: ['life', 'order'], realityLevel: 1 },
    { name: 'Огонь', icon: '🔥', description: 'Танцующее тепло, которое поглощает и трансформирует. Искра божественного солнца.', rarity: 'Обычный', type: 'Энергия', state: 'Плазма', temperature: 800, targetTemperature: 850, stability: 40, essences: ['destruction', 'chaos'], realityLevel: 1 },
    { name: 'Земля', icon: '🌍', description: 'Основа всего сущего. Тяжелая, безмолвная и выносливая.', rarity: 'Обычный', type: 'Материя', state: 'Твердое', temperature: 15, targetTemperature: 18, stability: 100, essences: ['order'], realityLevel: 1 },
    { name: 'Воздух', icon: '💨', description: 'Невидимое дыхание мира. Свободное, мимолетное и необходимое.', rarity: 'Обычный', type: 'Материя', state: 'Газ', temperature: 20, targetTemperature: 25, stability: 70, essences: ['void'], realityLevel: 1 },
    { name: 'Душа', icon: '✨', description: 'Искра сознания, оживляющая материю. Источник воли, чувств и самосознания.', rarity: 'Обычный', type: 'Энергия', state: 'Эфир', temperature: 36, targetTemperature: 37, stability: 80, essences: ['life', 'creation'], realityLevel: 1 },
    { name: 'Гравитация', icon: '🪐', description: 'Всепроникающее притяжение, искривляющее пространство и время. Сила, удерживающая миры в гармонии.', rarity: 'Обычный', type: 'Энергия', state: 'Эфир', temperature: 15, targetTemperature: 18, stability: 90, essences: ['order', 'void'], realityLevel: 1 },
    { name: 'Энергия', icon: '⚡', description: 'Чистая сила, движущая материю. Ее нельзя создать или уничтожить, только изменить.', rarity: 'Обычный', type: 'Энергия', state: 'Эфир', temperature: 100, targetTemperature: 120, stability: 50, essences: ['creation', 'chaos'], realityLevel: 1 },
    { name: 'Пустота', icon: '🌌', description: 'Первозданное ничто, из которого рождается всё. Великое пространство свободы от оков бытия.', rarity: 'Обычный', type: 'Материя', state: 'Эфир', temperature: -273, targetTemperature: -270, stability: 95, essences: ['void', 'death'], realityLevel: 1 }
  ];

  const now = Date.now();
  const values: any[] = [];
  const rowPlaceholders: string[] = [];
  let idx = 1;

  for (const el of basicElements) {
    rowPlaceholders.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++})`
    );
    values.push(
      `DISC-${userId}-${el.name}`,
      String(userId),
      el.name,
      el.description,
      el.icon,
      el.rarity,
      el.type,
      el.state,
      1,
      now,
      el.temperature,
      el.targetTemperature,
      el.stability,
      JSON.stringify(el.essences),
      el.realityLevel
    );
  }

  await queryRun(
    `INSERT INTO discovered_elements (
      id, userid, name, description, icon, rarity, type, state, complexity, discoveredat, temperature, targettemperature, stability, essences, realitylevel
    ) VALUES ${rowPlaceholders.join(', ')}
    ON CONFLICT (id) DO NOTHING`,
    values
  );

  const countRes = await queryGet<{ count: number }>('SELECT COUNT(*) as count FROM discovered_elements WHERE userid = $1', [String(userId)]);
  const discoveredCount = Number(countRes?.count || 8);
  const level = Math.max(1, Math.floor(discoveredCount / 10) + 1);

  await queryRun('UPDATE users SET discoveredcount = $1, level = $2 WHERE id = $3', [discoveredCount, level, String(userId)]);
}
