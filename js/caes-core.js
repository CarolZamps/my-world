/*
 * Lógica central do módulo Adestramento (sem dependências).
 * Funciona no navegador (window.CaesCore) e no Node (require) para os testes.
 * Datas de calendário são strings 'YYYY-MM-DD' no fuso America/Sao_Paulo.
 */
(function (root) {
  'use strict';

  const TZ = 'America/Sao_Paulo';

  // ── datas ──────────────────────────────────────────────
  function dataSP(d) {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d instanceof Date ? d : new Date(d));
    const p = Object.fromEntries(partes.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function isoParaUTC(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function addDias(iso, n) {
    return new Date(isoParaUTC(iso) + n * 86400000).toISOString().slice(0, 10);
  }

  function diffDias(a, b) {
    return Math.round((isoParaUTC(b) - isoParaUTC(a)) / 86400000);
  }

  // 0 = domingo … 6 = sábado
  function diaSemana(iso) {
    return new Date(isoParaUTC(iso)).getUTCDay();
  }

  // segunda-feira da semana da data
  function inicioSemana(iso) {
    const dow = diaSemana(iso);
    return addDias(iso, dow === 0 ? -6 : 1 - dow);
  }

  function intervaloDias(inicioISO, fimISO) {
    const out = [];
    for (let d = inicioISO; d <= fimISO; d = addDias(d, 1)) out.push(d);
    return out;
  }

  // ── pausas de passeio ──────────────────────────────────
  // pausa vale de `inicio` (inclusive) até `fim` (exclusive); fim null = vigente
  function emPausaNaData(pausas, iso) {
    return (pausas || []).some(p => p.inicio <= iso && (!p.fim || iso < p.fim));
  }

  // ── checklist do dia ───────────────────────────────────
  function itemValeNaFase(item, fasesPorId, faseAtual) {
    if (!item.fase_id) return true;
    if (!faseAtual) return false;
    if (item.fase_id === faseAtual.id) return true;
    const faseItem = fasesPorId[item.fase_id];
    return !!(item.continua && faseItem && faseItem.ordem <= faseAtual.ordem);
  }

  function itensDoDia({ itens, fases, faseAtualId, data, pausas }) {
    const fasesPorId = Object.fromEntries((fases || []).map(f => [f.id, f]));
    const faseAtual = fasesPorId[faseAtualId] || null;
    const dow = diaSemana(data);
    const pausa = emPausaNaData(pausas, data);
    return (itens || [])
      .filter(it => it.ativo !== false)
      .filter(it => !it.dias_semana || it.dias_semana.length === 0 || it.dias_semana.includes(dow))
      .filter(it => itemValeNaFase(it, fasesPorId, faseAtual))
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(it => {
        if (it.tipo === 'passeio' && pausa) {
          return { ...it, titulo: it.titulo_pausa || 'Atividade substituta', substituto: true };
        }
        return { ...it, substituto: false };
      });
  }

  function progressoDia(itensDia, idsFeitos) {
    const feitos = new Set(idsFeitos || []);
    const total = itensDia.length;
    const n = itensDia.filter(it => feitos.has(it.id)).length;
    return { feitos: n, total, pct: total ? n / total : 0 };
  }

  // ── sequência de dias consistentes ─────────────────────
  // historico: { 'YYYY-MM-DD': { feitos, total } }
  // Dia consistente = pelo menos `limiar` do checklist feito.
  // Dias sem itens não contam nem quebram. Hoje só soma se já estiver consistente
  // (e nunca quebra a sequência, porque o dia ainda não acabou).
  function calcularStreak(historico, hoje, limiar = 0.8) {
    const ok = d => {
      const h = historico[d];
      if (!h || !h.total) return null; // neutro
      return h.feitos / h.total >= limiar;
    };
    let atual = 0;
    if (ok(hoje) === true) atual = 1;
    const datas = Object.keys(historico).sort();
    const maisAntiga = datas[0] || hoje;
    for (let d = addDias(hoje, -1); d >= maisAntiga; d = addDias(d, -1)) {
      const r = ok(d);
      if (r === null) continue;
      if (!r) break;
      atual++;
    }
    let melhor = 0, corrente = 0;
    for (const d of intervaloDias(maisAntiga, hoje)) {
      const r = ok(d);
      if (r === null) continue;
      if (r) { corrente++; melhor = Math.max(melhor, corrente); }
      else if (d !== hoje) corrente = 0;
    }
    return { atual, melhor: Math.max(melhor, atual) };
  }

  // ── sons (Fase 3) ──────────────────────────────────────
  function sugerirVolume(volumeAtual, ultima) {
    const v = Math.min(10, Math.max(1, volumeAtual || 1));
    if (!ultima) return { volume: v, tipo: 'manter', texto: 'Comece bem baixinho, abaixo do limiar.' };
    if (ultima.reacao === 'latiu') {
      return { volume: Math.max(1, v - 1), tipo: 'voltar', texto: 'Na última sessão ela latiu. Que tal voltar um nível?' };
    }
    if (ultima.reacao === 'tensa') {
      return { volume: v, tipo: 'manter', texto: 'Ela ficou tensa: mantenha este volume até ficar tranquila.' };
    }
    if (ultima.olhou_esperando && v < 10) {
      return { volume: v + 1, tipo: 'subir', texto: 'Ela olhou para você esperando o petisco. Pode subir um nível!' };
    }
    return { volume: v, tipo: 'manter', texto: 'Mantenha o volume até ela olhar para você esperando o petisco.' };
  }

  // ── reatividade e passeios ─────────────────────────────
  const RECUPERACAO = ['<30s', '1min', '2-5min', '>5min'];
  const RECUPERACAO_SEG = { '<30s': 15, '1min': 60, '2-5min': 210, '>5min': 420 };
  const DISTANCIA_PONTOS = { perto: 1, medio: 2, longe: 3, muito_longe: 4 };
  const DISTANCIA_ROTULO = { 1: 'perto', 2: 'médio', 3: 'longe', 4: 'muito longe' };

  function duracaoMin(inicio, fim) {
    return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000));
  }

  // cao: { alerta_reacoes_max, alerta_recuperacao }
  function avaliarAlertaPasseio(encontros, cao) {
    const max = cao.alerta_reacoes_max ?? 2;
    const limiteRec = RECUPERACAO.indexOf(cao.alerta_recuperacao || '>5min');
    const reacoes = (encontros || []).filter(e => e.resultado === 'reagiu').length;
    const recuperacaoLonga = (encontros || []).some(e => e.recuperacao && RECUPERACAO.indexOf(e.recuperacao) >= limiteRec);
    const atingido = reacoes > max || recuperacaoLonga;
    let texto = null;
    if (atingido) {
      texto = 'Esse passeio pediu bastante dela. Talvez valha encurtar os próximos ou voltar um passo no plano. Vocês estão no caminho. 💛';
    }
    return { atingido, reacoes, recuperacaoLonga, texto };
  }

  // passeios: [{ inicio (data ISO ou timestamp), alerta: boolean }]
  function sugerirPausa(passeios, hoje, cao) {
    const qtd = cao.alerta_pausa_qtd ?? 3;
    const dias = cao.alerta_pausa_dias ?? 7;
    const desde = addDias(hoje, -(dias - 1));
    const n = (passeios || []).filter(p => {
      const d = p.inicio.length > 10 ? dataSP(p.inicio) : p.inicio;
      return p.alerta && d >= desde && d <= hoje;
    }).length;
    return {
      sugerir: n >= qtd,
      passeiosComAlerta: n,
      texto: n >= qtd
        ? `Nos últimos ${dias} dias, ${n} passeios foram intensos para ela. Que tal considerar uma pausa de passeios para baixar o estresse? A decisão é sua.`
        : null,
    };
  }

  // distância média em que ela fica bem, por estímulo
  function distanciaMediaBem(encontros) {
    const grupos = {};
    (encontros || []).forEach(e => {
      if (e.resultado !== 'bem' || !DISTANCIA_PONTOS[e.distancia]) return;
      (grupos[e.gatilho] = grupos[e.gatilho] || []).push(DISTANCIA_PONTOS[e.distancia]);
    });
    return Object.entries(grupos).map(([estimulo, pts]) => {
      const media = pts.reduce((a, b) => a + b, 0) / pts.length;
      return { estimulo, media, rotulo: DISTANCIA_ROTULO[Math.round(media)], n: pts.length };
    }).sort((a, b) => a.media - b.media);
  }

  // ── agregações do painel ───────────────────────────────
  function contarPorDia(registros, campoData, inicio, fim, filtro) {
    const cont = {};
    (registros || []).forEach(r => {
      if (filtro && !filtro(r)) return;
      const d = dataSP(r[campoData]);
      cont[d] = (cont[d] || 0) + 1;
    });
    return intervaloDias(inicio, fim).map(d => ({ data: d, n: cont[d] || 0 }));
  }

  // média dos últimos `janela` valores (ignora null); null se não houver nenhum
  function mediaMovel(valores, janela = 7) {
    return valores.map((_, i) => {
      const fatia = valores.slice(Math.max(0, i - janela + 1), i + 1).filter(v => v != null);
      return fatia.length ? fatia.reduce((a, b) => a + b, 0) / fatia.length : null;
    });
  }

  function mediaPorDia(registros, campoData, valorFn, inicio, fim) {
    const soma = {}, n = {};
    (registros || []).forEach(r => {
      const v = valorFn(r);
      if (v == null) return;
      const d = dataSP(r[campoData]);
      soma[d] = (soma[d] || 0) + v;
      n[d] = (n[d] || 0) + 1;
    });
    return intervaloDias(inicio, fim).map(d => ({ data: d, media: n[d] ? soma[d] / n[d] : null }));
  }

  function distribuicao(registros, campo) {
    const cont = {};
    (registros || []).forEach(r => {
      const k = r[campo];
      if (k == null || k === '') return;
      cont[k] = (cont[k] || 0) + 1;
    });
    const total = Object.values(cont).reduce((a, b) => a + b, 0);
    return Object.entries(cont)
      .map(([chave, n]) => ({ chave, n, pct: total ? n / total : 0 }))
      .sort((a, b) => b.n - a.n || a.chave.localeCompare(b.chave));
  }

  // historico: { data: { feitos, total } } → % geral no intervalo
  function adesaoChecklist(historico, inicio, fim) {
    let feitos = 0, total = 0;
    intervaloDias(inicio, fim).forEach(d => {
      const h = historico[d];
      if (h) { feitos += h.feitos; total += h.total; }
    });
    return total ? feitos / total : null;
  }

  // conta como reação: tudo o que veio de casa e, nos passeios, só "reagiu"
  function ehReacao(r) {
    return r.resultado ? r.resultado === 'reagiu' : true;
  }

  function passeiosPorSemana(passeios) {
    const grupos = {};
    (passeios || []).filter(p => p.fim || p.duracao_min != null).forEach(p => {
      const s = inicioSemana(dataSP(p.inicio));
      const g = grupos[s] = grupos[s] || { semana: s, n: 0, soma: 0 };
      g.n++;
      g.soma += p.duracao_min != null ? Number(p.duracao_min) : duracaoMin(p.inicio, p.fim);
    });
    return Object.values(grupos)
      .map(g => ({ semana: g.semana, n: g.n, duracaoMedia: g.soma / g.n }))
      .sort((a, b) => a.semana.localeCompare(b.semana));
  }

  // reações por passeio, por dia (média dos passeios do dia)
  function reacoesPorPasseio(passeios, encontros, inicio, fim) {
    const reacoesPor = {};
    (encontros || []).forEach(e => {
      if (e.passeio_id && e.resultado === 'reagiu') reacoesPor[e.passeio_id] = (reacoesPor[e.passeio_id] || 0) + 1;
    });
    return mediaPorDia(passeios, 'inicio', p => reacoesPor[p.id] || 0, inicio, fim);
  }

  const api = {
    TZ, RECUPERACAO, RECUPERACAO_SEG, DISTANCIA_PONTOS,
    dataSP, addDias, diffDias, diaSemana, inicioSemana, intervaloDias,
    emPausaNaData, itensDoDia, progressoDia, calcularStreak, sugerirVolume,
    duracaoMin, avaliarAlertaPasseio, sugerirPausa, distanciaMediaBem,
    contarPorDia, mediaMovel, mediaPorDia, distribuicao, adesaoChecklist, ehReacao,
    passeiosPorSemana, reacoesPorPasseio,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CaesCore = api;
})(typeof window !== 'undefined' ? window : this);
