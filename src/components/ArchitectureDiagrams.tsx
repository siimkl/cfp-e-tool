import type { ReactNode } from 'react';

function Box({
  x,
  y,
  title,
  lines,
  width = 280,
}: {
  x: number;
  y: number;
  title: string;
  lines: string[];
  width?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={width}
        height={60 + lines.length * 23}
        rx="10"
        fill="#f2f7f0"
        stroke="#739480"
      />
      <text x="16" y="30" fontWeight="700" fontSize="17">
        {title}
      </text>
      {lines.map((line, i) => (
        <text key={line} x="16" y={60 + i * 23} fontSize="14">
          {line}
        </text>
      ))}
    </g>
  );
}
function Diagram({
  id,
  title,
  description,
  height,
  children,
}: {
  id: string;
  title: string;
  description: string;
  height: number;
  children: ReactNode;
}) {
  return (
    <section className="architecture-diagram">
      <h2>{title}</h2>
      <p>{description}</p>
      <div
        className="architecture-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${title}: keritav joonis`}
      >
        <svg
          viewBox={`0 0 1040 ${height}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
        >
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-desc`}>{description}</desc>
          <defs>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#547465" />
            </marker>
          </defs>
          {children}
        </svg>
      </div>
    </section>
  );
}
function Arrow({
  id,
  path,
  label,
  x,
  y,
  dashed = false,
}: {
  id: string;
  path: string;
  label: string;
  x: number;
  y: number;
  dashed?: boolean;
}) {
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#547465"
        strokeWidth="2"
        strokeDasharray={dashed ? '7 5' : undefined}
        markerEnd={`url(#${id}-arrow)`}
      />
      <text x={x} y={y} textAnchor="middle" fontSize="13" fill="#334d40"
        stroke="white"
        strokeWidth="5"
        paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}
export function ArchitectureDiagrams() {
  return (
    <>
      <Diagram
        id="technical"
        title="Tehniline arhitektuur"
        height={820}
        description="GitHub Actions avaldab veebilehe GitHub Pagesis. Külastaja brauser loeb Supabase’i avalikke andmeid. Google Apps Script juhib eraldi taustatööd: loeb Gmaili, küsib OpenAI-lt struktureeritud andmed, kontrollib tulemusi ja salvestab need Supabase’i."
      >
        <Box
          x={30}
          y={25}
          title="GitHub → GitHub Actions"
          lines={['Lähtekood, testid ja Vite koostamine']}
          width={320}
        />
        <Box
          x={660}
          y={25}
          title="GitHub Pages"
          lines={['Staatilised HTML-, CSS- ja JS-failid']}
          width={340}
        />
        <Arrow
          id="technical"
          path="M350 70 H660"
          label="Avaldamine"
          x={505}
          y={58}
          dashed
        />
        <Box
          x={660}
          y={205}
          title="Külastaja brauser"
          lines={[
            'React + TypeScript',
            'Tabel, kategooriad ja filtrid',
            'Avalik Supabase’i võti',
          ]}
          width={340}
        />
        <Arrow
          id="technical"
          path="M830 108 V205"
          label="Veebilehe laadimine"
          x={910}
          y={163}
        />
        <Box
          x={660}
          y={440}
          title="Supabase"
          lines={[
            'REST API + PostgreSQL',
            'RLS: avalik lugemine, piiratud kirjutus',
            'Auth: haldurite autentimine',
            'RPC: allikate koondstatistika',
          ]}
          width={340}
        />
        <Arrow
          id="technical"
          path="M830 334 V440"
          label="HTTPS: päringud / halduri muudatused"
          x={825}
          y={391}
        />
        <Box
          x={30}
          y={440}
          title="Google Apps Script"
          lines={[
            'Ajastus ~04:00 ja ~16:00',
            'Kuni 30 kirja, lukk ja töötlusregister',
            'Valideerimine ja korduste ühendamine',
            'Salajased võtmed: Script Properties',
          ]}
          width={345}
        />
        <Arrow
          id="technical"
          path="M375 500 H660"
          label="HTTPS: loeb ja salvestab"
          x={517}
          y={487}
        />
        <Box
          x={30}
          y={205}
          title="Gmail"
          lines={[
            'Meililistid ja uudiskirjad',
            'Töötajate edasisaadetud kuulutused',
          ]}
          width={345}
        />
        <Arrow
          id="technical"
          path="M180 311 V440"
          label="GmailApp: kirjade lugemine"
          x={295}
          y={388}
        />
        <Box
          x={30}
          y={695}
          title="OpenAI API"
          lines={[
            'Tekst → struktureeritud kuulutused',
            'Algkeel säilib; kategooria eesti keeles',
          ]}
          width={345}
        />
        <Arrow
          id="technical"
          path="M180 592 V695"
          label="HTTPS: tekst sisse, JSON tagasi"
          x={305}
          y={655}
        />
        <text x="660" y="690" fontSize="15">
          Brauser ei kutsu OpenAI API-t.
        </text>
        <text x="660" y="716" fontSize="15">
          Import töötab ka suletud veebilehega.
        </text>
        <text x="660" y="742" fontSize="15">
          Katkendjoon: koodi avaldamine.
        </text>
      </Diagram>
      <Diagram
        id="data"
        title="Andmebaasi andmemudel"
        height={1070}
        description="Kuulutusel (items) võib olla mitu allikaviidet (item_sources). Iga allikaviide kuulub ühele töödeldud kirjale (processed_emails). source_receipts hoiab saabunud kirjade allikastatistikat; seos kirja ID kaudu on loogiline, mitte välisvõti. automation_runs salvestab käivituste koondandmed."
      >
        <Box
          x={35}
          y={30}
          width={350}
          title="items · kuulutused"
          lines={[
            'PK id',
            'item_type · CFP / EVENT',
            'title, journal, organiser, summary',
            'category · üks kuuest kategooriast',
            'topics[] · täpsemad teemasildid',
            'deadline / event_start / event_end',
            'event_mode, location, homepage_url',
            'dedupe_key · unikaalne kordusevõti',
            'source_type, archived, ajatemplid',
            'FK created_by → auth.users.id',
          ]}
        />
        <Box
          x={655}
          y={30}
          width={350}
          title="item_sources · allikaviited"
          lines={[
            'PK id',
            'FK item_id → items.id',
            'FK message_id → processed_emails',
            'source_url, source_excerpt',
            'extraction_confidence, created_at',
            'UNIQUE (item_id, message_id)',
          ]}
        />
        <Arrow
          id="data"
          path="M385 130 H655"
          label="1 kuulutus → 0…N viidet"
          x={520}
          y={116}
        />
        <Box
          x={655}
          y={380}
          width={350}
          title="processed_emails · töötlusregister"
          lines={[
            'PK message_id · Gmaili kirja ID',
            'thread_id, sender, subject, received_at',
            'processing_status, attempts',
            'extracted_count, error_message',
            'processed_at',
          ]}
        />
        <Arrow
          id="data"
          path="M830 380 V228"
          label="1 kiri → 0…N viidet"
          x={920}
          y={316}
        />
        <Box
          x={35}
          y={435}
          width={350}
          title="source_receipts · saabunud kirjad"
          lines={[
            'PK message_id · Gmaili kirja ID',
            'source_key, source_name, domain',
            'source_kind · LIST / NEWSLETTER',
            'classification · DIRECT /',
            'FORWARDED / UNKNOWN',
            'received_at, checked_at',
          ]}
        />
        <Arrow
          id="data"
          path="M385 512 H655"
          label="Sama message_id (0…1 : 0…1)"
          x={520}
          y={497}
          dashed
        />
        <Box
          x={35}
          y={760}
          width={350}
          title="automation_runs · käivitused"
          lines={[
            'PK id',
            'started_at, finished_at, status',
            'emails_seen, emails_processed',
            'items_created, duplicates_found, errors',
            'Eraldi koondlogi; välisvõtmed puuduvad',
          ]}
        />
        <Box
          x={655}
          y={730}
          width={350}
          title="source_statistics() · avalik RPC"
          lines={[
            'Koondab DIRECT-kirjad ajakirja kaupa',
            'Loeb erinevaid message_id väärtusi',
            'Seob receipts → sources → items',
            'Tundmatu ajakiri: nimekirja/allika rida',
            'Avaldab nime, arvu ja ajavahemiku',
          ]}
        />
        <text x="35" y="1015" fontSize="14">
          PK = primaarvõti · FK = välisvõti · katkendjoon = loogiline seos ilma
          välisvõtmeta
        </text>
        <text x="35" y="1044" fontSize="14">
          Avalikult loetavad: arhiveerimata items ja koondstatistika. Kirjade
          täistekste ei salvestata.
        </text>
      </Diagram>
    </>
  );
}
