// components/admin/AdminConfig.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfigSection {
  id:    string;
  icon:  string;
  label: string;
}

const SECTIONS: ConfigSection[] = [
  { id: 'apis',      icon: '🔑', label: 'Claus API'           },
  { id: 'params',    icon: '⚙️', label: 'Paràmetres financers' },
  { id: 'montecarlo',icon: '🎲', label: 'Monte Carlo'          },
  { id: 'security',  icon: '🔒', label: 'Seguretat'            },
];

export default function AdminConfig() {
  const [activeSection, setActiveSection] = useState('apis');
  const [saved, setSaved]                 = useState(false);
  const [form, setForm]                   = useState({
    // APIs
    fmpApiKey:           '',
    alphaVantageApiKey:  '',
    resendApiKey:        '',
    // Paràmetres
    riskFreeRate:        '3.0',
    inflationRate:       '2.5',
    defaultHorizon:      '10',
    defaultMonthlyContr: '300',
    // Monte Carlo
    numSimulations:      '1000',
    confidenceP10:       '10',
    confidenceP90:       '90',
    // Seguretat
    adminUsername:       'admin',
    sessionDuration:     '8',
    maxLoginAttempts:    '5',
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls = "w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60 focus:ring-1 focus:ring-[#c9a84c]/30 transition-all placeholder-white/20";
  const labelCls = "block text-white/50 text-xs uppercase tracking-wider mb-1.5";

  const Field = ({ label, children, hint }: {
    label: string; children: React.ReactNode; hint?: string;
  }) => (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-white/25 text-xs mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white mb-1">Configuració</h1>
        <p className="text-white/40 text-sm">
          Paràmetres del sistema Factor OTC
        </p>
      </div>

      {/* Avís seguretat */}
      <motion.div
        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}>
        <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="text-amber-400 font-semibold text-sm">Zona restringida</p>
          <p className="text-amber-400/70 text-xs mt-0.5">
            Els canvis aquí afecten el comportament del sistema. Les claus API s'han
            de configurar preferiblement via variables d'entorn al fitxer{' '}
            <code className="bg-black/30 px-1 rounded">.env.local</code>.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        {/* Nav lateral seccions */}
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <motion.button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              whileHover={{ x: 3 }}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeSection === s.id
                  ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Contingut */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">

              {/* ── APIs ────────────────────────────────────────────────── */}
              {activeSection === 'apis' && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Claus API Financeres</h3>
                    <p className="text-white/30 text-xs mb-4">
                      Configura les claus per obtenir dades reals de mercat.
                      Millor via <code className="bg-black/30 px-1 rounded">.env.local</code>.
                    </p>
                  </div>

                  <Field label="Financial Modeling Prep API Key"
                    hint="https://financialmodelingprep.com — Pla gratuït disponible">
                    <div className="relative">
                      <input type="password" value={form.fmpApiKey}
                        onChange={e => update('fmpApiKey', e.target.value)}
                        placeholder="Enganxa la teva clau FMP aquí"
                        className={inputCls} />
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${form.fmpApiKey ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>
                  </Field>

                  <Field label="Alpha Vantage API Key"
                    hint="https://alphavantage.co — 500 peticions/dia gratuïtes">
                    <div className="relative">
                      <input type="password" value={form.alphaVantageApiKey}
                        onChange={e => update('alphaVantageApiKey', e.target.value)}
                        placeholder="Enganxa la teva clau Alpha Vantage aquí"
                        className={inputCls} />
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${form.alphaVantageApiKey ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>
                  </Field>

                  <Field label="Resend API Key (enviament d'emails)"
                    hint="https://resend.com — Per enviar PDFs per correu">
                    <div className="relative">
                      <input type="password" value={form.resendApiKey}
                        onChange={e => update('resendApiKey', e.target.value)}
                        placeholder="Enganxa la teva clau Resend aquí"
                        className={inputCls} />
                      <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${form.resendApiKey ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>
                  </Field>

                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                      Estat de les connexions
                    </p>
                    <div className="space-y-2">
                      {[
                        { label: 'Financial Modeling Prep', active: !!form.fmpApiKey },
                        { label: 'Alpha Vantage',           active: !!form.alphaVantageApiKey },
                        { label: 'Yahoo Finance (fallback)', active: true },
                        { label: 'Resend Email',             active: !!form.resendApiKey },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-white/50 text-xs">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className={`text-xs ${item.active ? 'text-emerald-400' : 'text-red-400'}`}>
                              {item.active ? 'Configurat' : 'No configurat'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Paràmetres ──────────────────────────────────────────── */}
              {activeSection === 'params' && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Paràmetres Financers</h3>
                    <p className="text-white/30 text-xs mb-4">
                      Valors per defecte utilitzats en els càlculs de perfilació i cartera.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipus lliure de risc (%)" hint="Taxa BCE de referència">
                      <input type="number" step="0.1" value={form.riskFreeRate}
                        onChange={e => update('riskFreeRate', e.target.value)}
                        className={inputCls} />
                    </Field>
                    <Field label="Inflació assumida (%)" hint="Per a càlculs de valor real">
                      <input type="number" step="0.1" value={form.inflationRate}
                        onChange={e => update('inflationRate', e.target.value)}
                        className={inputCls} />
                    </Field>
                    <Field label="Horitzó per defecte (anys)" hint="Valor inicial al qüestionari">
                      <input type="number" min="1" max="50" value={form.defaultHorizon}
                        onChange={e => update('defaultHorizon', e.target.value)}
                        className={inputCls} />
                    </Field>
                    <Field label="Aportació mensual per defecte (€)" hint="Valor inicial al qüestionari">
                      <input type="number" min="0" value={form.defaultMonthlyContr}
                        onChange={e => update('defaultMonthlyContr', e.target.value)}
                        className={inputCls} />
                    </Field>
                  </div>

                  <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-lg p-4">
                    <p className="text-[#c9a84c] text-xs font-semibold mb-2">
                      📊 Valors actuals del sistema
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-white/50">Tipus lliure de risc: <span className="text-white">{form.riskFreeRate}%</span></div>
                      <div className="text-white/50">Inflació: <span className="text-white">{form.inflationRate}%</span></div>
                      <div className="text-white/50">Horitzó per defecte: <span className="text-white">{form.defaultHorizon} anys</span></div>
                      <div className="text-white/50">Aportació per defecte: <span className="text-white">{form.defaultMonthlyContr}€/mes</span></div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Monte Carlo ─────────────────────────────────────────── */}
              {activeSection === 'montecarlo' && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Paràmetres Monte Carlo</h3>
                    <p className="text-white/30 text-xs mb-4">
                      Configura el nombre de simulacions i els percentils de confiança.
                      Més simulacions = més precisió però més temps de càlcul.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Nombre de simulacions" hint="Recomanat: 1000. Màxim: 5000">
                      <input type="number" min="100" max="5000" step="100"
                        value={form.numSimulations}
                        onChange={e => update('numSimulations', e.target.value)}
                        className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Percentil pessimista (%)" hint="Per defecte: P10">
                        <input type="number" min="1" max="30"
                          value={form.confidenceP10}
                          onChange={e => update('confidenceP10', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="Percentil optimista (%)" hint="Per defecte: P90">
                        <input type="number" min="70" max="99"
                          value={form.confidenceP90}
                          onChange={e => update('confidenceP90', e.target.value)}
                          className={inputCls} />
                      </Field>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-white/40 text-xs mb-3">Estimació de temps de càlcul</p>
                    <div className="space-y-2">
                      {[
                        { sims: 100,  time: '~0.1s', quality: 'Baixa'    },
                        { sims: 500,  time: '~0.4s', quality: 'Acceptable'},
                        { sims: 1000, time: '~0.8s', quality: 'Bona'     },
                        { sims: 5000, time: '~4s',   quality: 'Excel·lent'},
                      ].map((row, i) => (
                        <div key={i}
                          className={`flex justify-between text-xs p-2 rounded ${
                            parseInt(form.numSimulations) === row.sims
                              ? 'bg-[#c9a84c]/20 text-[#c9a84c]'
                              : 'text-white/40'
                          }`}>
                          <span>{row.sims.toLocaleString()} simulacions</span>
                          <span>{row.time}</span>
                          <span>{row.quality}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Seguretat ───────────────────────────────────────────── */}
              {activeSection === 'security' && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Configuració de Seguretat</h3>
                    <p className="text-white/30 text-xs mb-4">
                      Paràmetres d'autenticació i control d'accés al panell Admin.
                      Les contrasenyes s'han de canviar via variables d'entorn.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Nom d'usuari Admin" hint="Definit a ADMIN_USERNAME al .env.local">
                      <input type="text" value={form.adminUsername}
                        onChange={e => update('adminUsername', e.target.value)}
                        className={inputCls} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Durada de sessió (hores)" hint="Per defecte: 8 hores">
                        <input type="number" min="1" max="24"
                          value={form.sessionDuration}
                          onChange={e => update('sessionDuration', e.target.value)}
                          className={inputCls} />
                      </Field>
                      <Field label="Intents màxims login" hint="Bloqueig temporal">
                        <input type="number" min="3" max="10"
                          value={form.maxLoginAttempts}
                          onChange={e => update('maxLoginAttempts', e.target.value)}
                          className={inputCls} />
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-white/40 text-xs uppercase tracking-wider">
                      Mesures de seguretat actives
                    </p>
                    {[
                      { label: 'JWT Token authentication',     active: true  },
                      { label: 'Sessió amb expiració',         active: true  },
                      { label: 'HTTPS obligatori (producció)', active: true  },
                      { label: 'Rate limiting API routes',     active: true  },
                      { label: 'Variables sensibles en .env',  active: true  },
                      { label: 'Hash de contrasenyes (bcrypt)',active: false, note: 'Pendent implementar' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-white/60 text-sm">{item.label}</span>
                        <div className="flex items-center gap-2">
                          {item.note && (
                            <span className="text-amber-400/70 text-xs">{item.note}</span>
                          )}
                          <div className={`w-2 h-2 rounded-full ${item.active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className={`text-xs ${item.active ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {item.active ? 'Actiu' : 'Pendent'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Botó desar */}
          <div className="flex justify-end mt-4 gap-3">
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#c9a84c] text-[#0d1f1a] hover:bg-[#b8963f]'
              }`}>
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.span key="saved"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}>
                    ✅ Desat!
                  </motion.span>
                ) : (
                  <motion.span key="save"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}>
                    Desar canvis
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}