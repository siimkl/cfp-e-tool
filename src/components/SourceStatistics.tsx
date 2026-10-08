import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type SourceStat = {
  source_name: string;
  source_domain: string;
  source_kind: string;
  email_count: number;
  first_received_at: string;
  last_received_at: string;
};
const date = (value: string) =>
  new Date(value).toLocaleDateString('et-EE', { timeZone: 'Europe/Tallinn' });

export function SourceStatistics() {
  const [rows, setRows] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    async function load() {
      try {
        if (!supabase) throw new Error('Not configured');
        const all: SourceStat[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase
            .rpc('source_statistics')
            .range(offset, offset + 499);
          if (error) throw error;
          all.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        if (!cancelled) setRows(all);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return (
    <>
      <p className="info-lead">
        Otse saabunud kirjad ajakirjade kaupa. Sama kirjastaja või meililisti
        kaudu saabuvad eri ajakirjad kuvatakse eraldi ridadel.
      </p>
      <p>
        Ajakiri tuvastatakse kirjaga seotud kuulutuste ajakirjanime järgi. Kui
        ajakirja pole tuvastatud, kuvatakse kiri üldise meililisti või
        uudiskirja all, märkega „Ajakiri tuvastamata”. Edasisaatmise tunnustega
        kirju, vastuseid ja ebaselge päritoluga kirju ei loendata. See ülevaade
        ei kinnita, et tellimus on endiselt aktiivne.
      </p>
      <p className="muted">
        Loendus koguneb automaatika kontrollitud kirjadest. Iga kontroll hõlmab
        kuni 30 viimast saabunud kirja; kogu postkasti ajaloolist loendust siin
        ei ole. Varem töödeldud kirjad lisatakse loendusse, kui need on veel
        selles valimis. Uuendus toimub postkasti järgmise kontrolli järel.
      </p>
      {loading ? (
        <p role="status">Allikate laadimine…</p>
      ) : error ? (
        <div className="error" role="alert">
          Allikate laadimine ebaõnnestus.{' '}
          <button onClick={() => setAttempt(attempt + 1)}>Proovi uuesti</button>
        </div>
      ) : rows.length ? (
        <>
          <p>
            {rows.filter((row) => row.source_kind === 'JOURNAL').length}{' '}
            ajakirja
            {' · '}
            {rows.filter((row) => row.source_kind !== 'JOURNAL').length} üldist
            allikat
          </p>
          <p className="muted">
            Sama kiri läheb ühe ajakirja juures arvesse üks kord. Mitut ajakirja
            käsitlev kiri võib esineda mitme ajakirja loenduses; ridade arve ei
            liideta kirjade koguarvuks.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Jälgitavate allikate tabel"
            tabIndex={0}
          >
            <table className="source-statistics-table">
              <caption className="sr-only">
                Otse saabunud kirjade allikad ja arvud
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ajakiri / meililist / allikas</th>
                  <th scope="col">Liik</th>
                  <th scope="col">Kirju</th>
                  <th scope="col">Esimene kiri</th>
                  <th scope="col">Viimane kiri</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.source_domain}-${row.source_name}-${index}`}>
                    <td>
                      <strong>{row.source_name}</strong>
                      <small>{row.source_domain}</small>
                      {row.source_kind !== 'JOURNAL' && (
                        <small>Ajakiri tuvastamata</small>
                      )}
                    </td>
                    <td>
                      {row.source_kind === 'JOURNAL'
                        ? 'Ajakiri'
                        : row.source_kind === 'LIST'
                          ? 'Üldine meililist'
                          : 'Üldine uudiskiri'}
                    </td>
                    <td>{row.email_count}</td>
                    <td>{date(row.first_received_at)}</td>
                    <td>{date(row.last_received_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>Otse saabunud allikaid pole veel tuvastatud</h2>
          <p>
            Tabel täieneb postkasti järgmiste kontrollide käigus. Edasisaadetud
            kirjad siin allikana ei kajastu.
          </p>
        </div>
      )}
      <p>
        <a href="#/allikad">Lisa uus allikas, mida jälgida →</a>
      </p>
    </>
  );
}
