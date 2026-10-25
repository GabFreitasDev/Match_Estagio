-- =====================================================================
-- MatchEstágio - Modelo de Dados v2 (PostgreSQL)
-- Frente 1 - Sprint 1
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- EMPRESA
-- Empresas importadas (origem_cadastro = 'IMPORTADA') podem não ter
-- cnpj, email e senha. Empresas de cadastro próprio devem ter todos.
-- ---------------------------------------------------------------------
CREATE TABLE empresa (
    id_empresa       SERIAL PRIMARY KEY,
    razao_social     VARCHAR(200) NOT NULL,
    cnpj             CHAR(14)     UNIQUE,
    email            VARCHAR(150) UNIQUE,
    senha_hash       VARCHAR(255),
    setor            VARCHAR(100),
    site             VARCHAR(255),
    descricao        TEXT,
    origem_cadastro  VARCHAR(10)  NOT NULL DEFAULT 'PROPRIA'
        CHECK (origem_cadastro IN ('PROPRIA', 'IMPORTADA')),
    criado_em        TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_empresa_cadastro_proprio CHECK (
        origem_cadastro = 'IMPORTADA'
        OR (cnpj IS NOT NULL AND email IS NOT NULL AND senha_hash IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------
-- CANDIDATO
-- ---------------------------------------------------------------------
CREATE TABLE candidato (
    id_candidato   SERIAL PRIMARY KEY,
    nome           VARCHAR(150) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    senha_hash     VARCHAR(255) NOT NULL,
    curso          VARCHAR(120) NOT NULL,
    instituicao    VARCHAR(150),
    periodo_atual  SMALLINT CHECK (periodo_atual BETWEEN 1 AND 20),
    cidade         VARCHAR(100),
    uf             CHAR(2),
    link_perfil    VARCHAR(255),
    aceite_lgpd    BOOLEAN   NOT NULL DEFAULT FALSE,
    aceite_lgpd_em TIMESTAMP,
    criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_candidato_lgpd CHECK (aceite_lgpd = TRUE)
);

-- ---------------------------------------------------------------------
-- HABILIDADE
-- ---------------------------------------------------------------------
CREATE TABLE habilidade (
    id_habilidade  SERIAL PRIMARY KEY,
    nome           VARCHAR(100) NOT NULL UNIQUE,
    categoria      VARCHAR(20)  NOT NULL
        CHECK (categoria IN ('TECNICA', 'COMPORTAMENTAL', 'IDIOMA'))
);

-- ---------------------------------------------------------------------
-- VAGA
-- ---------------------------------------------------------------------
CREATE TABLE vaga (
    id_vaga                  SERIAL PRIMARY KEY,
    id_empresa               INT NOT NULL REFERENCES empresa(id_empresa),
    id_candidato_importador  INT REFERENCES candidato(id_candidato),
    titulo                   VARCHAR(150) NOT NULL,
    descricao                TEXT NOT NULL,
    atividades               TEXT,
    curso_desejado           VARCHAR(120),
    periodo_minimo           SMALLINT CHECK (periodo_minimo BETWEEN 1 AND 20),
    modelo_trabalho          VARCHAR(12) NOT NULL
        CHECK (modelo_trabalho IN ('PRESENCIAL', 'HIBRIDO', 'REMOTO')),
    cidade                   VARCHAR(100),
    uf                       CHAR(2),
    carga_horaria_semanal    SMALLINT CHECK (carga_horaria_semanal BETWEEN 1 AND 30),
    valor_bolsa              NUMERIC(10,2) CHECK (valor_bolsa >= 0),
    beneficios               TEXT,
    qtd_vagas                SMALLINT NOT NULL DEFAULT 1 CHECK (qtd_vagas >= 1),
    data_publicacao          DATE,
    prazo_inscricao          DATE,
    status_vaga              VARCHAR(10) NOT NULL DEFAULT 'RASCUNHO'
        CHECK (status_vaga IN ('RASCUNHO', 'ABERTA', 'PAUSADA', 'ENCERRADA')),
    origem                   VARCHAR(7) NOT NULL DEFAULT 'INTERNA'
        CHECK (origem IN ('INTERNA', 'EXTERNA')),
    plataforma_origem        VARCHAR(80),
    url_origem               VARCHAR(500),
    data_importacao          TIMESTAMP,
    criado_em                TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_vaga_prazo CHECK (
        prazo_inscricao IS NULL OR data_publicacao IS NULL
        OR prazo_inscricao >= data_publicacao
    ),
    -- campos de importação só fazem sentido em vagas externas
    CONSTRAINT ck_vaga_externa CHECK (
        (origem = 'EXTERNA' AND url_origem IS NOT NULL AND id_candidato_importador IS NOT NULL)
        OR (origem = 'INTERNA' AND id_candidato_importador IS NULL
            AND plataforma_origem IS NULL AND url_origem IS NULL
            AND data_importacao IS NULL)
    )
);

-- ---------------------------------------------------------------------
-- VAGA_HABILIDADE (N:N)
-- ---------------------------------------------------------------------
CREATE TABLE vaga_habilidade (
    id_vaga        INT NOT NULL REFERENCES vaga(id_vaga) ON DELETE CASCADE,
    id_habilidade  INT NOT NULL REFERENCES habilidade(id_habilidade),
    nivel_minimo   SMALLINT NOT NULL DEFAULT 1 CHECK (nivel_minimo BETWEEN 1 AND 5),
    obrigatoria    BOOLEAN  NOT NULL DEFAULT FALSE,
    peso_match     NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (peso_match > 0),
    PRIMARY KEY (id_vaga, id_habilidade)
);

-- ---------------------------------------------------------------------
-- CANDIDATO_HABILIDADE (N:N)
-- ---------------------------------------------------------------------
CREATE TABLE candidato_habilidade (
    id_candidato      INT NOT NULL REFERENCES candidato(id_candidato) ON DELETE CASCADE,
    id_habilidade     INT NOT NULL REFERENCES habilidade(id_habilidade),
    nivel             SMALLINT NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
    anos_experiencia  NUMERIC(3,1) NOT NULL DEFAULT 0 CHECK (anos_experiencia >= 0),
    PRIMARY KEY (id_candidato, id_habilidade)
);

-- ---------------------------------------------------------------------
-- CANDIDATURA
-- Fluxo sequencial de status (ajuste os nomes se o time definir outros)
-- ---------------------------------------------------------------------
CREATE TABLE candidatura (
    id_candidatura    SERIAL PRIMARY KEY,
    id_candidato      INT NOT NULL REFERENCES candidato(id_candidato),
    id_vaga           INT NOT NULL REFERENCES vaga(id_vaga),
    status            VARCHAR(15) NOT NULL DEFAULT 'INTERESSADO'
        CHECK (status IN ('INTERESSADO', 'INSCRITO', 'EM_ANALISE',
                          'ENTREVISTA', 'APROVADO', 'REPROVADO')),
    posicao_kanban    INT NOT NULL DEFAULT 0,
    taxa_match        NUMERIC(5,2) CHECK (taxa_match BETWEEN 0 AND 100),
    data_candidatura  TIMESTAMP NOT NULL DEFAULT NOW(),
    data_atualizacao  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidatura UNIQUE (id_candidato, id_vaga)
);

-- ---------------------------------------------------------------------
-- ALERTA
-- ---------------------------------------------------------------------
CREATE TABLE alerta (
    id_alerta       SERIAL PRIMARY KEY,
    id_candidatura  INT NOT NULL REFERENCES candidatura(id_candidatura) ON DELETE CASCADE,
    data_hora       TIMESTAMP NOT NULL,
    motivo          VARCHAR(255) NOT NULL,
    tipo            VARCHAR(40)  NOT NULL,
    canal           VARCHAR(5)   NOT NULL CHECK (canal IN ('EMAIL', 'APP')),
    enviado         BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------
-- RESUMO_DUVIDAS (incorpora a antiga tabela RESPOSTA)
-- ---------------------------------------------------------------------
CREATE TABLE resumo_duvidas (
    id_resumo            SERIAL PRIMARY KEY,
    id_vaga              INT NOT NULL REFERENCES vaga(id_vaga),
    id_empresa_resposta  INT REFERENCES empresa(id_empresa),
    texto_resumo         TEXT NOT NULL,
    tema_principal       VARCHAR(150),
    qtd_duvidas          INT NOT NULL DEFAULT 0 CHECK (qtd_duvidas >= 0),
    modelo_ia            VARCHAR(80),
    gerado_em            TIMESTAMP NOT NULL DEFAULT NOW(),
    resposta_oficial     TEXT,
    respondido_em        TIMESTAMP,
    CONSTRAINT ck_resumo_resposta CHECK (
        (resposta_oficial IS NULL AND respondido_em IS NULL AND id_empresa_resposta IS NULL)
        OR (resposta_oficial IS NOT NULL AND respondido_em IS NOT NULL
            AND id_empresa_resposta IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------
-- DUVIDA (id_resumo fica nulo até a IA sumarizar)
-- ---------------------------------------------------------------------
CREATE TABLE duvida (
    id_duvida     SERIAL PRIMARY KEY,
    id_candidato  INT NOT NULL REFERENCES candidato(id_candidato),
    id_vaga       INT NOT NULL REFERENCES vaga(id_vaga),
    id_resumo     INT REFERENCES resumo_duvidas(id_resumo),
    texto         TEXT NOT NULL,
    data_envio    TIMESTAMP NOT NULL DEFAULT NOW(),
    status_duvida VARCHAR(10) NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_duvida IN ('PENDENTE', 'RESUMIDA'))
);

-- ---------------------------------------------------------------------
-- ÍNDICES (consultas de listagem, filtros, Kanban e alertas)
-- ---------------------------------------------------------------------
CREATE INDEX idx_vaga_empresa        ON vaga (id_empresa);
CREATE INDEX idx_vaga_status_prazo   ON vaga (status_vaga, prazo_inscricao);
CREATE INDEX idx_vaga_filtros        ON vaga (curso_desejado, modelo_trabalho, uf, cidade);
CREATE INDEX idx_vh_habilidade       ON vaga_habilidade (id_habilidade);
CREATE INDEX idx_ch_habilidade       ON candidato_habilidade (id_habilidade);
CREATE INDEX idx_candidatura_vaga    ON candidatura (id_vaga);
CREATE INDEX idx_candidatura_kanban  ON candidatura (id_candidato, status, posicao_kanban);
CREATE INDEX idx_alerta_pendente     ON alerta (enviado, data_hora);
CREATE INDEX idx_duvida_vaga_status  ON duvida (id_vaga, status_duvida);
CREATE INDEX idx_duvida_resumo       ON duvida (id_resumo);
CREATE INDEX idx_resumo_vaga         ON resumo_duvidas (id_vaga);

-- ---------------------------------------------------------------------
-- CARGA INICIAL DE HABILIDADES
-- ---------------------------------------------------------------------
INSERT INTO habilidade (nome, categoria) VALUES
  ('Java', 'TECNICA'), ('Python', 'TECNICA'), ('JavaScript', 'TECNICA'),
  ('TypeScript', 'TECNICA'), ('C#', 'TECNICA'), ('PHP', 'TECNICA'),
  ('HTML/CSS', 'TECNICA'), ('React', 'TECNICA'), ('Node.js', 'TECNICA'),
  ('Spring Boot', 'TECNICA'), ('SQL', 'TECNICA'), ('PostgreSQL', 'TECNICA'),
  ('MySQL', 'TECNICA'), ('MongoDB', 'TECNICA'), ('Git', 'TECNICA'),
  ('Docker', 'TECNICA'), ('APIs REST', 'TECNICA'), ('Excel', 'TECNICA'),
  ('Power BI', 'TECNICA'), ('Análise de Dados', 'TECNICA'),
  ('Testes de Software', 'TECNICA'), ('Figma', 'TECNICA'),
  ('Metodologias Ágeis', 'TECNICA'),
  ('Comunicação', 'COMPORTAMENTAL'), ('Trabalho em Equipe', 'COMPORTAMENTAL'),
  ('Proatividade', 'COMPORTAMENTAL'), ('Organização', 'COMPORTAMENTAL'),
  ('Resolução de Problemas', 'COMPORTAMENTAL'),
  ('Inglês', 'IDIOMA'), ('Espanhol', 'IDIOMA');

COMMIT;
