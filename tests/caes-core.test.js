// Rodar com: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/caes-core.js');

test('dataSP usa o fuso de São Paulo', () => {
  // 02:30 UTC de 26/11 ainda é 25/11 em São Paulo (UTC-3)
  assert.equal(C.dataSP('2026-11-26T02:30:00Z'), '2026-11-25');
  assert.equal(C.dataSP('2026-11-26T03:30:00Z'), '2026-11-26');
});

test('datas: dia da semana, soma e início da semana', () => {
  assert.equal(C.diaSemana('2026-11-25'), 3); // quarta
  assert.equal(C.addDias('2026-11-30', 1), '2026-12-01');
  assert.equal(C.diffDias('2026-11-25', '2026-12-02'), 7);
  assert.equal(C.inicioSemana('2026-11-29'), '2026-11-23'); // domingo → segunda anterior
  assert.equal(C.inicioSemana('2026-11-23'), '2026-11-23');
});

const fases = [
  { id: 'f0', ordem: 0 }, { id: 'f1', ordem: 1 }, { id: 'f2', ordem: 2 },
];
const itens = [
  { id: 'diario', fase_id: null, titulo: 'Registrar diário', ordem: 0 },
  { id: 'ruido', fase_id: 'f1', continua: true, titulo: 'Ruído branco', ordem: 10 },
  { id: 'passeio', fase_id: 'f1', continua: true, titulo: 'Passeio', tipo: 'passeio',
    titulo_pausa: 'Atividade substituta', dias_semana: [1, 3, 5], ordem: 14 },
  { id: 'so-f1', fase_id: 'f1', continua: false, titulo: 'Só na fase 1', ordem: 15 },
  { id: 'fund', fase_id: 'f2', continua: true, titulo: 'Fundamentos', ordem: 20 },
  { id: 'off', fase_id: null, titulo: 'Inativo', ativo: false, ordem: 1 },
];

test('checklist: itens de todas as fases, da fase atual e os que continuam', () => {
  const f2 = C.itensDoDia({ itens, fases, faseAtualId: 'f2', data: '2026-11-25' }).map(i => i.id);
  assert.deepEqual(f2, ['diario', 'ruido', 'passeio', 'fund']);
  const f0 = C.itensDoDia({ itens, fases, faseAtualId: 'f0', data: '2026-11-25' }).map(i => i.id);
  assert.deepEqual(f0, ['diario']);
  const f1 = C.itensDoDia({ itens, fases, faseAtualId: 'f1', data: '2026-11-25' }).map(i => i.id);
  assert.deepEqual(f1, ['diario', 'ruido', 'passeio', 'so-f1']);
});

test('checklist: respeita os dias da semana', () => {
  const qui = C.itensDoDia({ itens, fases, faseAtualId: 'f1', data: '2026-11-26' }).map(i => i.id);
  assert.ok(!qui.includes('passeio'));
});

test('checklist: em pausa, o passeio vira atividade substituta', () => {
  const pausas = [{ inicio: '2026-11-20', fim: null }];
  const lista = C.itensDoDia({ itens, fases, faseAtualId: 'f1', data: '2026-11-25', pausas });
  const p = lista.find(i => i.id === 'passeio');
  assert.equal(p.titulo, 'Atividade substituta');
  assert.equal(p.substituto, true);
  // depois de retomar, volta ao normal
  const retomado = [{ inicio: '2026-11-20', fim: '2026-11-25' }];
  const p2 = C.itensDoDia({ itens, fases, faseAtualId: 'f1', data: '2026-11-25', pausas: retomado }).find(i => i.id === 'passeio');
  assert.equal(p2.titulo, 'Passeio');
});

test('progresso do dia', () => {
  const dia = C.itensDoDia({ itens, fases, faseAtualId: 'f2', data: '2026-11-25' });
  assert.deepEqual(C.progressoDia(dia, ['diario', 'fund', 'xx']), { feitos: 2, total: 4, pct: 0.5 });
  assert.equal(C.progressoDia([], []).pct, 0);
});

test('streak: conta dias consistentes e não quebra pelo dia de hoje', () => {
  const h = {
    '2026-11-20': { feitos: 1, total: 5 },
    '2026-11-21': { feitos: 5, total: 5 },
    '2026-11-22': { feitos: 4, total: 5 },
    '2026-11-23': { feitos: 0, total: 0 }, // dia sem itens: neutro
    '2026-11-24': { feitos: 5, total: 5 },
    '2026-11-25': { feitos: 1, total: 5 }, // hoje, ainda em andamento
  };
  assert.deepEqual(C.calcularStreak(h, '2026-11-25'), { atual: 3, melhor: 3 });
  h['2026-11-25'] = { feitos: 5, total: 5 };
  assert.deepEqual(C.calcularStreak(h, '2026-11-25'), { atual: 4, melhor: 4 });
});

test('streak: quebra quando um dia anterior fica abaixo do limiar', () => {
  const h = {
    '2026-11-22': { feitos: 5, total: 5 },
    '2026-11-23': { feitos: 5, total: 5 },
    '2026-11-24': { feitos: 2, total: 5 },
    '2026-11-25': { feitos: 5, total: 5 },
  };
  assert.deepEqual(C.calcularStreak(h, '2026-11-25'), { atual: 1, melhor: 2 });
  assert.deepEqual(C.calcularStreak({}, '2026-11-25'), { atual: 0, melhor: 0 });
});

test('sugestão de volume dos sons', () => {
  assert.equal(C.sugerirVolume(4, { reacao: 'latiu' }).volume, 3);
  assert.equal(C.sugerirVolume(1, { reacao: 'latiu' }).volume, 1);
  assert.equal(C.sugerirVolume(4, { reacao: 'tensa', olhou_esperando: true }).volume, 4);
  assert.equal(C.sugerirVolume(4, { reacao: 'sem_reacao', olhou_esperando: true }).volume, 5);
  assert.equal(C.sugerirVolume(10, { reacao: 'percebeu', olhou_esperando: true }).volume, 10);
  assert.equal(C.sugerirVolume(4, { reacao: 'percebeu' }).tipo, 'manter');
  assert.equal(C.sugerirVolume(3, null).volume, 3);
});

test('passeio: duração em minutos', () => {
  assert.equal(C.duracaoMin('2026-11-25T10:00:00Z', '2026-11-25T10:23:40Z'), 24);
});

const cao = { alerta_reacoes_max: 2, alerta_recuperacao: '>5min', alerta_pausa_qtd: 3, alerta_pausa_dias: 7 };

test('alerta do passeio: mais de 2 reações ou recuperação acima de 5 min', () => {
  const r = { resultado: 'reagiu', recuperacao: '1min' };
  assert.equal(C.avaliarAlertaPasseio([r, r], cao).atingido, false);
  assert.equal(C.avaliarAlertaPasseio([r, r, r], cao).atingido, true);
  assert.equal(C.avaliarAlertaPasseio([{ resultado: 'tensa', recuperacao: '>5min' }], cao).atingido, true);
  assert.equal(C.avaliarAlertaPasseio([{ resultado: 'bem' }], cao).texto, null);
  // limite configurável
  assert.equal(C.avaliarAlertaPasseio([r], { ...cao, alerta_reacoes_max: 0 }).atingido, true);
});

test('sugestão de pausa: 3 passeios com alerta em 7 dias', () => {
  const ps = [
    { inicio: '2026-11-18', alerta: true },  // fora da janela (19 a 25)
    { inicio: '2026-11-20', alerta: true },
    { inicio: '2026-11-22', alerta: false },
    { inicio: '2026-11-24', alerta: true },
  ];
  assert.equal(C.sugerirPausa(ps, '2026-11-25', cao).sugerir, false);
  ps.push({ inicio: '2026-11-25T13:00:00Z', alerta: true });
  const s = C.sugerirPausa(ps, '2026-11-25', cao);
  assert.equal(s.sugerir, true);
  assert.equal(s.passeiosComAlerta, 3);
});

test('distância média em que ela fica bem, por estímulo', () => {
  const enc = [
    { gatilho: 'Cachorro', resultado: 'bem', distancia: 'muito_longe' },
    { gatilho: 'Cachorro', resultado: 'bem', distancia: 'longe' },
    { gatilho: 'Cachorro', resultado: 'reagiu', distancia: 'perto' },
    { gatilho: 'Moto', resultado: 'bem', distancia: 'medio' },
  ];
  const r = C.distanciaMediaBem(enc);
  assert.deepEqual(r.map(x => x.estimulo), ['Moto', 'Cachorro']);
  assert.equal(r[1].media, 3.5);
  assert.equal(r[1].n, 2);
  assert.equal(r[0].rotulo, 'médio');
});

test('painel: contagem por dia, média móvel e distribuição', () => {
  const regs = [
    { data_hora: '2026-11-24T12:00:00Z', gatilho: 'Moto' },
    { data_hora: '2026-11-24T15:00:00Z', gatilho: 'Moto' },
    { data_hora: '2026-11-25T12:00:00Z', gatilho: 'Portão' },
  ];
  assert.deepEqual(C.contarPorDia(regs, 'data_hora', '2026-11-23', '2026-11-25').map(x => x.n), [0, 2, 1]);
  assert.deepEqual(C.mediaMovel([0, 2, 1, null], 2), [0, 1, 1.5, 1]);
  const d = C.distribuicao(regs, 'gatilho');
  assert.equal(d[0].chave, 'Moto');
  assert.ok(Math.abs(d[0].pct - 2 / 3) < 1e-9);
});

test('painel: só conta como reação o que reagiu (casa conta sempre)', () => {
  assert.equal(C.ehReacao({}), true);
  assert.equal(C.ehReacao({ resultado: 'reagiu' }), true);
  assert.equal(C.ehReacao({ resultado: 'bem' }), false);
});

test('painel: média por dia e adesão ao checklist', () => {
  const regs = [
    { data_hora: '2026-11-24T12:00:00Z', recuperacao: '1min' },
    { data_hora: '2026-11-24T13:00:00Z', recuperacao: '>5min' },
  ];
  const m = C.mediaPorDia(regs, 'data_hora', r => C.RECUPERACAO_SEG[r.recuperacao], '2026-11-24', '2026-11-25');
  assert.deepEqual(m, [{ data: '2026-11-24', media: 240 }, { data: '2026-11-25', media: null }]);
  const h = { '2026-11-24': { feitos: 3, total: 4 }, '2026-11-25': { feitos: 1, total: 4 } };
  assert.equal(C.adesaoChecklist(h, '2026-11-24', '2026-11-25'), 0.5);
  assert.equal(C.adesaoChecklist({}, '2026-11-24', '2026-11-25'), null);
});

test('painel de passeios: por semana e reações por passeio', () => {
  const ps = [
    { id: 'a', inicio: '2026-11-23T12:00:00Z', fim: '2026-11-23T12:20:00Z' },
    { id: 'b', inicio: '2026-11-25T12:00:00Z', duracao_min: 30 },
    { id: 'c', inicio: '2026-11-25T20:00:00Z', fim: null }, // em andamento: fora
  ];
  assert.deepEqual(C.passeiosPorSemana(ps), [{ semana: '2026-11-23', n: 2, duracaoMedia: 25 }]);
  const enc = [
    { passeio_id: 'b', resultado: 'reagiu' }, { passeio_id: 'b', resultado: 'reagiu' },
    { passeio_id: 'b', resultado: 'bem' },
  ];
  const r = C.reacoesPorPasseio(ps.slice(0, 2), enc, '2026-11-23', '2026-11-25');
  assert.deepEqual(r.map(x => x.media), [0, null, 2]);
});

test('fase em vigor em cada data, pelo histórico', () => {
  const hist = [
    { para_fase_id: 'f1', criado_em: '2026-11-20T12:00:00Z' },
    { para_fase_id: 'f0', criado_em: '2026-11-10T12:00:00Z' },
    { para_fase_id: 'f2', criado_em: '2026-11-26T02:00:00Z' }, // 25/11 23h em SP
  ];
  assert.equal(C.faseNaData(hist, '2026-11-09', 'f2'), null);
  assert.equal(C.faseNaData(hist, '2026-11-15', 'f2'), 'f0');
  assert.equal(C.faseNaData(hist, '2026-11-24', 'f2'), 'f1');
  assert.equal(C.faseNaData(hist, '2026-11-25', 'f2'), 'f2');
  assert.equal(C.faseNaData([], '2026-11-25', 'f2'), 'f2');
});

test('histórico do checklist usa a fase de cada dia e alimenta a sequência', () => {
  const hist = [
    { para_fase_id: 'f0', criado_em: '2026-11-22T12:00:00Z' },
    { para_fase_id: 'f1', criado_em: '2026-11-24T12:00:00Z' },
  ];
  const marcas = [
    { item_id: 'diario', data: '2026-11-22' },
    { item_id: 'diario', data: '2026-11-23' },
    { item_id: 'diario', data: '2026-11-24' }, { item_id: 'ruido', data: '2026-11-24' },
    { item_id: 'so-f1', data: '2026-11-24' }, // terça: passeio não vale
  ];
  const h = C.historicoChecklist({ itens, fases, historicoFases: hist, marcas, inicio: '2026-11-21', fim: '2026-11-25', faseAtualId: 'f1' });
  assert.deepEqual(h['2026-11-21'], { feitos: 0, total: 0 }); // antes do plano
  assert.deepEqual(h['2026-11-22'], { feitos: 1, total: 1 });
  assert.deepEqual(h['2026-11-24'], { feitos: 3, total: 3 });
  assert.deepEqual(h['2026-11-25'], { feitos: 0, total: 4 }); // quarta: inclui passeio
  assert.deepEqual(C.calcularStreak(h, '2026-11-25'), { atual: 3, melhor: 3 });
});
