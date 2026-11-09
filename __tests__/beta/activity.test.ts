import { describe, it, expect, beforeEach } from 'vitest';
import { weekStart, madridDay, summarizeUsage, recordActivity, getActivitySince, __resetActivityForTests, type ActivityRow } from '@/lib/betaActivity';

const clients = [
  { id: 'a', name: 'Anna', email: 'a@x.com' },
  { id: 'b', name: 'Bernat', email: 'b@x.com' },
  { id: 'c', name: 'Carla', email: 'c@x.com' },
];
// Dimecres 11/11/2026 → setmana actual comença dilluns 9/11
const now = new Date('2026-11-11T12:00:00Z');

describe('weekStart', () => {
  it('torna el dilluns 00:00 UTC', () => {
    expect(weekStart(now).toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(weekStart(new Date('2026-11-15T23:59:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z'); // diumenge
    expect(weekStart(new Date('2026-11-09T00:00:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z');
  });
});

describe('summarizeUsage', () => {
  const rows: ActivityRow[] = [
    // Anna: 2 dies aquesta setmana (3 esdeveniments), 1 dia fa dues setmanes
    { userId: 'a', event: 'login',           at: '2026-11-09T08:00:00Z' },
    { userId: 'a', event: 'finances.view',   at: '2026-11-09T08:01:00Z' },
    { userId: 'a', event: 'finances.update', at: '2026-11-10T19:00:00Z' },
    { userId: 'a', event: 'login',           at: '2026-10-27T10:00:00Z' },
    // Bernat: només la setmana passada
    { userId: 'b', event: 'portfolio.view',  at: '2026-11-03T10:00:00Z' },
    // Fora de la finestra de 4 setmanes
    { userId: 'b', event: 'login',           at: '2026-09-01T10:00:00Z' },
    // Usuari que no és client (admin): s'ignora
    { userId: 'admin', event: 'login',       at: '2026-11-10T10:00:00Z' },
  ];

  const s = summarizeUsage(rows, clients, { a: '2026-10-27T09:00:00Z' }, now, 4);

  it('genera les setmanes de la més antiga a l\'actual', () => {
    expect(s.weeks).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
  });

  it('compta dies diferents, no esdeveniments', () => {
    const a = s.clients.find(c => c.id === 'a')!;
    expect(a.activeDays).toEqual([0, 1, 0, 2]);
    expect(a.weeksActive).toBe(2);
    expect(a.logins).toBe(2);
    expect(a.updates).toBe(1);
    expect(a.consentAt).toBe('2026-10-27T09:00:00Z');
  });

  it('el darrer accés pot ser anterior a la finestra', () => {
    const b = s.clients.find(c => c.id === 'b')!;
    expect(b.activeDays).toEqual([0, 0, 1, 0]);
    expect(b.lastSeen).toBe('2026-11-03T10:00:00Z');
    expect(b.consentAt).toBeNull();
  });

  it('un client sense activitat surt amb zeros', () => {
    const c = s.clients.find(c => c.id === 'c')!;
    expect(c.activeDays).toEqual([0, 0, 0, 0]);
    expect(c.lastSeen).toBeNull();
  });

  it('calcula clients actius per setmana i ordena pels més actius', () => {
    expect(s.weeklyActive).toEqual([0, 1, 1, 1]);
    expect(s.clients.map(c => c.id)).toEqual(['a', 'b', 'c']);
    expect(s.clients.some(c => c.id === 'admin')).toBe(false);
  });

  it('ignora esdeveniments amb data futura', () => {
    const r = summarizeUsage([{ userId: 'c', event: 'login', at: '2026-11-20T10:00:00Z' }], clients, {}, now, 4);
    expect(r.clients.find(c => c.id === 'c')!.weeksActive).toBe(0);
  });
});

describe('recordActivity (memòria)', () => {
  beforeEach(() => __resetActivityForTests());
  it('desa i recupera des d\'una data', async () => {
    recordActivity('a', 'login', new Date('2026-11-01T10:00:00Z'));
    recordActivity('a', 'finances.view', new Date('2026-11-10T10:00:00Z'));
    recordActivity(undefined, 'login');
    const rows = await getActivitySince(new Date('2026-11-05T00:00:00Z'));
    expect(rows).toEqual([{ userId: 'a', event: 'finances.view', at: '2026-11-10T10:00:00.000Z', page: null }]);
  });
});

describe('temps connectat', () => {
  // Dimecres 11/11/2026 12:00 UTC (13:00 a Madrid)
  const ping = (at: string, page: 'finances' | 'cartera' | 'altres' = 'finances'): ActivityRow => ({ userId: 'a', event: 'ping', at, page });
  const rows: ActivityRow[] = [
    // avui: 3 pings en 3 minuts diferents + 1 de repetit al mateix minut
    ping('2026-11-11T09:00:05Z'), ping('2026-11-11T09:01:10Z'), ping('2026-11-11T09:01:40Z'), ping('2026-11-11T09:02:00Z', 'cartera'),
    // fa 3 dies: 2 minuts
    ping('2026-11-08T20:00:00Z'), ping('2026-11-08T20:01:00Z'),
    // fa 20 dies: 1 minut (només compta a 30 dies)
    ping('2026-10-22T10:00:00Z', 'altres'),
    // fa 40 dies: fora
    ping('2026-10-02T10:00:00Z'),
    { userId: 'a', event: 'login', at: '2026-11-08T19:59:00Z' },
    { userId: 'a', event: 'login', at: '2026-09-01T10:00:00Z' },
  ];
  const c = summarizeUsage(rows, clients, {}, now, 8).clients.find(x => x.id === 'a')!;

  it('compta minuts diferents, no pings', () => {
    expect(c.minutes).toEqual({ today: 3, week: 5, month: 6 });
  });

  it('dies actius i entrades dels darrers 30 dies', () => {
    expect(c.daysActive30).toBe(3);
    expect(c.logins30).toBe(1);
  });

  it('reparteix el temps per secció', () => {
    expect(c.byPage30).toEqual({ finances: 4, cartera: 1, altres: 1 });
  });

  it('el dia es compta a l\'hora de Madrid', () => {
    // 23:30 UTC del 10/11 ja és l'11/11 a Madrid
    expect(madridDay(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
    const r = summarizeUsage([ping('2026-11-10T23:30:00Z')], clients, {}, now, 8).clients.find(x => x.id === 'a')!;
    expect(r.minutes.today).toBe(1);
  });
});
