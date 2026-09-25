import React, { useState } from 'react';
import {
  History,
  BookOpen,
  Calendar,
  ExternalLink,
  Award,
  Shield,
  Sparkles,
  FileText,
  User,
  Search,
  Compass,
  Layers,
} from 'lucide-react';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';

interface TimelineEvent {
  year: string;
  title: string;
  badge: string;
  description: string;
}

const TIMELINE_EVENTS: readonly TimelineEvent[] = Object.freeze([
  {
    year: '1936',
    title: 'The Origin & The Jansen Patent',
    badge: 'Invention',
    description:
      'On April 16, 1936, Theodoor Nicol Maria Jansen of Schiedam files Dutch Patent Request #77428 (Octrooi No. 42.613) for an 8×8 board marked with movement circles and lines. Jan Boogerd is commissioned to invent the actual rules, piece mechanics, and scoring to turn the board into a playable mind sport. An early prototype is named "Janbo" (after Boogerd) and briefly manufactured as "Schaakdam" by Schilte & Zonen of Ysselstein.',
  },
  {
    year: '1937-1938',
    title: 'Firma Groenteman, Perry & Co., and "Het Wereld Spel"',
    badge: 'Publication',
    description:
      'Firma Groenteman & Co. of Amsterdam acquires patent rights and promotes Schada. Company owner Mr. Groenteman - also chairman of the Amsterdam Checkers Society - demonstrates the game publicly on December 13, 1937. In 1938, luxury distributor Perry & Co. markets Schada in three wooden editions (30cm, 35cm, 41½cm) as "Het Wereld Spel" (The World Game).',
  },
  {
    year: '1938-1939',
    title: 'Rotterdam Championship & The 1939 Rulebook',
    badge: 'Tournaments',
    description:
      'Schada is played competitively in the Rotterdam Individual Championships (Persoonlijk Kampioenschap) in 1938 and 1939. Jan Boogerd publishes his official "Handleiding voor het Denkspel Schada" in Rotterdam, declaring it "De grootste denkmeter ter wereld" (The greatest measure of thought in the world). An original copy is preserved in the Koninklijke Bibliotheek in The Hague.',
  },
  {
    year: '1940-1945',
    title: 'Wartime Occupation & The Multicolor Edition',
    badge: 'WWII Survival',
    description:
      'Following the May 1940 bombing of Rotterdam and Nazi occupation of the Netherlands, Firma Groenteman ceases operations. A simplified cardboard wartime edition is produced by Multicolor of Deventer bearing German occupation control mark "K744" (Rijksbureau). Boogerd invents the "Sparo-Leg-Enverduisteringspuzzle" (blackout puzzle) during the occupation curfews.',
  },
  {
    year: '1974',
    title: 'The 77-Year-Old Inventor in De Tijd',
    badge: 'Rediscovery',
    description:
      'National newspapers De Tijd (June 24, 1974) and Nieuwsblad van het Noorden publish feature interviews with Jan Boogerd, now 77 and living at Kerstroosstraat 6, Rotterdam. Photographed behind his original Schada board, Boogerd shares his ongoing inventions including "Vliegende Vogel" and notes that a publisher has acquired Schada for a prospective re-release.',
  },
  {
    year: '1980s-2016',
    title: "Fred Horn's Archival Investigation",
    badge: 'Historical Research',
    description:
      "Games historian Fred Horn embarks on a 35-year search to document Boogerd and Schada. After privacy law barriers in the 1980s, a 2015 online genealogical breakthrough uncovers Boogerd's full biography. Horn presents his findings at the Board Game Studies Colloquium XIX in Nürnberg (April 2016), published in the AGPC Quarterly.",
  },
  {
    year: 'Present',
    title: 'Modern Digital Re-Evaluation',
    badge: 'Living Legacy',
    description:
      "Kerry Handscomb publishes an in-depth translation and rule commentary in The New Abstract Games (AbstractGames.org). Today, Schada is brought to life online as a digital competitive platform honoring Boogerd's original 1936 vision.",
  },
]);

interface OtherInvention {
  name: string;
  type: string;
  description: string;
}

const BOOGERD_INVENTIONS: readonly OtherInvention[] = Object.freeze([
  {
    name: 'Dambo ("Dambord Boogerd")',
    type: 'Hexagonal Checkers',
    description:
      "A tactical draughts/checkers variant played on a custom board with hexagonal fields, mentioned in Boogerd's 1941 leaflet.",
  },
  {
    name: 'Strada',
    type: 'Pocket Strategy Game',
    description:
      'A compact travel game offering 105 distinct starting tactical configurations, designed for deep analytical play on the go.',
  },
  {
    name: 'Corner ("Homas-Spel")',
    type: 'Soccer Strategy Board Game',
    description:
      'A football/soccer adaptation of Schada published by Homas, featuring a green pitch where player pieces move according to directional arrows and circles.',
  },
  {
    name: 'Roldice',
    type: 'Dice Thinking Game',
    description:
      'A rolling dice mind game combining tactical path planning with dice face values ("The rolling dice").',
  },
  {
    name: 'Flying Bird ("Vliegende Vogel")',
    type: 'Dexterity Game',
    description:
      "A children's mechanical dexterity game developed in Boogerd's later years and featured in his 1974 De Tijd interview.",
  },
  {
    name: 'Puzzles',
    type: 'Wartime Blackout Puzzle (1941)',
    description:
      'An ingenious leisure puzzle designed during the dark winter blackout curfews in occupied Rotterdam.',
  },
]);

export const HistoryGuide: React.FC = () => {
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<number>(0);
  const { gameMetadata } = SCHADA_RULES_CONFIG;

  return (
    <div className="rules-page-container">
      {/* Hero Section */}
      <div className="rules-hero">
        <div className="rules-hero-icon">
          <History size={28} />
        </div>
        <h1 className="rules-title">The History of Schada</h1>
        <p className="rules-subtitle">
          From 1936 Rotterdam to the Modern Era<br />The Incredible Journey of{' '}
          <em>"De Grootste Denkmeter ter Wereld"</em>
        </p>

        {/* Archival Metadata Chips */}
        <div className="rules-stat-chips">
          <span className="rules-chip">
            <User size={14} color="var(--accent-blue)" /> {gameMetadata.inventor} (1897–1985)
          </span>
          <span className="rules-chip highlight">
            <Sparkles size={14} color="var(--accent-gold)" /> Dutch Patent (1936)
          </span>
          <span className="rules-chip">
            <Calendar size={14} color="var(--accent-green)" /> First Published (1936–1938)
          </span>
          <span className="rules-chip">
            <Award size={14} color="var(--accent-gold)" /> "The World Game"
          </span>
        </div>
      </div>

      {/* Primary Research Citation Banner */}
      <div className="rules-card" style={{ borderLeft: '4px solid var(--accent-gold)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <BookOpen size={24} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Historical Research Provenance
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The history documented on this page is based on extensive archival investigations by games historian{' '}
              <strong>Fred Horn</strong> (presented at the <em>Board Game Studies Colloquium XIX</em> in Nürnberg and published in the{' '}
              <em>AGPC Quarterly</em>, Summer 2016) and game scholar <strong>Kerry Handscomb</strong> (editor of{' '}
              <em>The New Abstract Games</em>), drawing from original 1936–1942 artifacts, Dutch patent registers, and the 1939 rulebook preserved in the{' '}
              <strong>Koninklijke Bibliotheek</strong> in The Hague.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.75rem' }}>
              <a
                href="https://www.stichtingspel.org/sites/default/files/agpc_quarterly_2016_18-2-2_schada.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--accent-blue)',
                  textDecoration: 'none',
                }}
              >
                <FileText size={14} /> View Fred Horn's 2016 Paper (PDF) <ExternalLink size={12} />
              </a>
              <a
                href="https://www.abstractgames.org/schada.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--accent-blue)',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} /> Read Kerry Handscomb's Article on AbstractGames.org
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Chapter 1: The Origin & The Patent */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Sparkles size={22} color="var(--accent-gold)" />
            1. The Spark: Patent No. 42.613 & The Inventor
          </h2>
          <span className="rules-card-badge">1936–1937</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          On <strong>April 16, 1936</strong>, an application for a Dutch patent (request number 77428) was filed by{' '}
          <strong>Theodoor Nicol Maria Jansen</strong> of Schiedam. The patent was granted and made public on{' '}
          <strong>September 15, 1937</strong> as <strong>Octrooi No. 42.613</strong>.
        </p>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          Crucially, Jansen's patent was for a <em>speelbord</em> (game board) only-an 8×8 grid with drilled peg holes and printed directional lines with dots-and did <strong>not</strong> contain any rules for a game. Recognising the potential of the concept, patent holders sought an inventor to transform the abstract grid into a compelling sport of the mind. That inventor was <strong>Jan Boogerd</strong>.
        </p>

        <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Who Was Jan Boogerd?
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Jan Boogerd was born on <strong>April 10, 1897</strong> in Goes, Zeeland, and lived most of his life in Rotterdam. He married Pieternella van der Doe, and together they raised two sons in Rotterdam-West (residing at Rochussenstraat 179a in 1940, and later Kerstroosstraat 6). Boogerd was an avid mind-sport innovator who dedicated decades to crafting original strategy games until his passing on <strong>November 2, 1985</strong> at age 88.
          </p>
        </div>

        <blockquote className="rules-quote">
          "The Octrooi has expired now. But be aware that it cannot be copied. The 'authors-rights' are mine. It is not free for everyone to imitate... Before the War an 'Israëliet' [Mr. Groenteman] sold it for me. That was good selling."
          <span className="rules-quote-author">- Jan Boogerd, looking back in 1974</span>
        </blockquote>
      </div>

      {/* Chapter 2: The Evolution of the Name */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Compass size={22} color="var(--accent-blue)" />
            2. The Evolution of the Name: From "Janbo" to "Schada"
          </h2>
          <span className="rules-card-badge">Eponymous Roots</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          Boogerd's game underwent three distinct naming phases between 1936 and 1938:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-gold)', marginBottom: '0.25rem' }}>
              Phase 1: "Janbo"
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Boogerd first christened his game <strong>"Janbo"</strong>-an affectionate acronym formed from his own first and last name (<strong>Jan</strong> <strong>Bo</strong>-ogerd).
            </p>
          </div>

          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-blue)', marginBottom: '0.25rem' }}>
              Phase 2: "Schaakdam"
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Around 1936, a version named <strong>"Schaakdam"</strong> was published by Schilte & Zonen of Ysselstein. Archival photos survive in the Spaarnestad Haarlem collection, stamped <em>"Alle rechten voorbehouden"</em> (All rights reserved).
            </p>
          </div>

          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--accent-green)', marginBottom: '0.25rem' }}>
              Phase 3: "Schada"
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Boogerd soon combined the two dominant Dutch mind games into a single portmanteau: <strong>SCHA</strong>-ak (Chess) + <strong>DA</strong>-mspel (Checkers/Draughts) = <strong>SCHADA</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 3: Pre-War Tournaments & Commercial Promotion */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Award size={22} color="var(--accent-gold)" />
            3. The Pre-War Zenith: Patents and Rotterdam Championships
          </h2>
          <span className="rules-card-badge">1937–1939</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          On <strong>February 15, 1938</strong>, an identical Dutch patent was published under the name of{' '}
          <strong>Firma Groenteman & Co. te Amsterdam</strong>, followed by a Belgian import patent (No. 426980) on April 30, 1938. Mr. Groenteman, the head of the firm, was also chairman of the prestigious{' '}
          <em>Amsterdamschen Dambond</em> (Amsterdam Checkers Society). Groenteman threw his full promotional weight behind the game.
        </p>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          The national newspaper <em>Het Vaderland</em> reported on <strong>December 13, 1937</strong> that a major public demonstration of Schada had taken place in Rotterdam ('het Zuid') with Mr. Groenteman presenting in person. High-level competitive matches soon followed: Boogerd himself recorded in his 1939 rule booklet that games of Schada were played during the official{' '}
          <strong>Persoonlijk Kampioenschap van Rotterdam</strong> (Rotterdam Individual Championship) in <strong>1938 and 1939</strong>.
        </p>

        <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            The 1938 Perry & Co. Flier
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            In 1938, distributor Perry & Co. published a commercial advertising flier proclaiming:
            <br />
            <em>"SCHADA: Het nieuwe spel voor 2 personen, volgens geheel nieuwe principes. Nederlandsche uitvinding!"</em>
            <br />
            Perry & Co. offered the game in three distinct handcrafted wooden formats: 30 cm, 35 cm, and 41½ cm with round drilled peg holes, priced between 3.85 and 6.60 Dutch guilders.
          </p>
        </div>

        {/* Royal Library Quote */}
        <blockquote className="rules-quote">
          "When looking at the Schada game board you will definitely wonder what these dots on the 64 spaces are for. But these dots, respected reader, represent something new in the sport of thinking... The aim of my invention was to make the value and the movement of the game-pieces dependent on the spaces, in contrast with existing board games. Thereby, a real way to measure thinking evolved, according to the powers of the players to win points in the games that they play... I advise anyone who starts to play the game Schada not to look at it as easy, because that would lead to disappointment when playing against a more serious player. After a short while, it was clear to me that the problems to solve and the possibilities of play have no limit."
          <span className="rules-quote-author">
            - Jan Boogerd, <em>Handleiding voor Schada</em> (Rotterdam, 1939 - Koninklijke Bibliotheek Den Haag)
          </span>
        </blockquote>
      </div>

      {/* Chapter 4: WWII Occupation & Cardboard Wartime Sets */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Shield size={22} color="var(--accent-red)" />
            4. World War II: The Bombing of Rotterdam & Wartime Manufacture
          </h2>
          <span className="rules-card-badge">1940–1945</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          The golden rise of Schada was abruptly halted in <strong>May 1940</strong> with the invasion of the Netherlands and the devastating aerial bombardment of Rotterdam. Neither Firma Groenteman & Co. nor the peacetime distribution channels survived the catastrophe of the war.
        </p>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          Yet the game refused to vanish entirely. During the German occupation, a simplified cardboard edition was published by{' '}
          <strong>Multicolor of Deventer</strong>. To operate under occupation rationing, the set was stamped with official control number{' '}
          <strong>"K744"</strong> (assigned by the <em>Rijksbureau</em> for paper and cardboard allocation).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Pre-War Wooden Sets (1938)
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Heavy, thick wooden boards with rounded or sharp corners. Peg pieces crafted out of lathe-turned wood or molded metal, housed in a polished wooden slide box with "Schada" printed on the lid.
            </p>
          </div>

          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Wartime Cardboard Sets (c. 1941–1942)
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Produced with thinner compressed cardboard and fiberboard due to strict wartime material quotas. Pieces stored in cardboard cartons. Surviving sets documented in the collection of Hans Hendrix and Fred Horn.
            </p>
          </div>
        </div>
      </div>

      {/* Chapter 5: Jan Boogerd's Other Mind Game Inventions */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Layers size={22} color="var(--accent-blue)" />
            5. The Inventor's Universe: Boogerd's Other Creations
          </h2>
          <span className="rules-card-badge">Portfolio</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          Schada was Jan Boogerd's magnum opus, but his restless inventiveness produced a series of other strategic games documented in his 1941 leaflet for the <em>Janbo Puzzle</em> and in his 1974 newspaper interviews:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {BOOGERD_INVENTIONS.map((inv) => (
            <div key={inv.name} style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {inv.name}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '0.35rem' }}>
                {inv.type}
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {inv.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Timeline */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Calendar size={22} color="var(--accent-green)" />
            6. Interactive Chronology: 90 Years of Schada
          </h2>
          <span className="rules-card-badge">Timeline</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          {TIMELINE_EVENTS.map((event, idx) => {
            const isSelected = selectedTimelineEvent === idx;
            return (
              <button
                key={event.year}
                type="button"
                className={`rules-tab-btn ${isSelected ? 'active' : ''}`}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                onClick={() => setSelectedTimelineEvent(idx)}
              >
                {event.year}
              </button>
            );
          })}
        </div>

        {/* Selected Event Display */}
        <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {TIMELINE_EVENTS[selectedTimelineEvent].year}: {TIMELINE_EVENTS[selectedTimelineEvent].title}
            </div>
            <span className="rules-chip highlight" style={{ fontSize: '0.75rem' }}>
              {TIMELINE_EVENTS[selectedTimelineEvent].badge}
            </span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {TIMELINE_EVENTS[selectedTimelineEvent].description}
          </p>
        </div>
      </div>

      {/* Chapter 7: The Long Rediscovery & Modern Era */}
      <div className="rules-card">
        <div className="rules-card-header">
          <h2 className="rules-card-title">
            <Search size={22} color="var(--accent-gold)" />
            7. The Long Rediscovery: Fred Horn & Kerry Handscomb
          </h2>
          <span className="rules-card-badge">1980s–Present</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          In the early 1980s, Dutch game historian <strong>Fred Horn</strong> discovered a vintage copy of Schada and set out to uncover who J. Boogerd was. Initial searches through Rotterdam telephone directories yielded no clues, and official municipal registries were barred by Dutch privacy laws.
        </p>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
          In 1991, collector Hans Hendrix wrote to Horn offering his wartime set. Decades later, in <strong>2015</strong>, newly digitized online genealogical records finally revealed Boogerd's full life story. Horn located the 1974 newspaper interviews and the original patent documents at the Dutch Patent Office in The Hague.
        </p>

        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          In <strong>April 2016</strong>, Horn presented his landmark research at the <em>Board Game Studies Colloquium XIX</em> at the Spiele-Archiv Nürnberg. Shortly thereafter, <strong>Kerry Handscomb</strong> rewritten and clarified the rules for modern abstract game enthusiasts in <em>The New Abstract Games</em>.
        </p>

        <div style={{ background: 'var(--bg-tertiary)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Experience Jan Boogerd's Genius Today
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 1rem' }}>
            Nearly nine decades after its patent in Rotterdam, Schada lives on. Play matches, explore vector strategies, and measure your thinking on the 64 squares!
          </p>
          <a
            href="https://www.abstractgames.org/schada.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--accent-blue)',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            <BookOpen size={16} /> Read Full Paper on AbstractGames.org <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};
