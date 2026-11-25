# Adestramento — banco de dados

Migrações aplicadas no Supabase (histórico em `supabase_migrations.schema_migrations`):

1. `create_adestramento_tables` — 12 tabelas `caes*` com RLS "anon full access"
2. `seed_maria_eugenia` — perfil, Fases 0–4, critérios, checklist e listas da Maria Eugênia
3. `adestramento_passeios` — `caes_passeios`, `caes_passeio_pausas`, encontros na própria
   `caes_reatividade` (`passeio_id`, `distancia`, `resultado`), item de checklist do tipo
   passeio com texto substituto, e limites de alerta por cão

| Tabela | Conteúdo |
|---|---|
| `caes` | perfil, fase atual, início do plano, limites de alerta de passeio |
| `caes_fases` | fases ordenadas: objetivo, descrição, critérios (jsonb), duração |
| `caes_fase_historico` | início / avanço / volta / ajuste de fase |
| `caes_checklist_itens` | modelos: fase (null = todas), `continua`, dias da semana, tipo, `titulo_pausa` |
| `caes_checklist_marcas` | item marcado por dia |
| `caes_listas` | listas editáveis: gatilho, local, exercicio, funcionou, petisco, tipo_passeio, rota, equipamento |
| `caes_sessoes` | sessões de treino |
| `caes_reatividade` | latidos em casa e encontros em passeio (com `passeio_id`) |
| `caes_sons` / `caes_sons_sessoes` | sons gravados da Fase 3 e histórico |
| `caes_passeios` / `caes_passeio_pausas` | passeios e períodos de pausa |
| `caes_revisoes` | revisão semanal |
| `caes_saude` | consultas, medicações, anotações |

A lógica (checklist do dia, sequência, sugestão de volume, alertas de passeio e
agregações do painel) fica em `js/caes-core.js`. Testes: `node --test tests/*.test.js`.
