import type { ReactNode } from 'react'
import { ArrowRight, ArrowUpRight, Check, Plus } from 'lucide-react'
import { navigate } from '@/lib/hash'
import './home-mockups.css'
import { offshoreRacingImage } from './offshore-racing-image'

const editorialPhoto = `${import.meta.env.BASE_URL}mockups/editorial-sailing.webp`
const racingPhoto = offshoreRacingImage

const faqs = [
  {
    q: 'Do sailors need a Crewlist account?',
    a: 'No. Sailors use the team link you share, choose a race and sign up. Only team organisers need accounts.',
  },
  {
    q: 'How do sailors find our team?',
    a: 'Share your team’s direct Crewlist link through your usual channel. Crewlist does not publish a searchable directory of teams.',
  },
  {
    q: 'Can more than one person manage our races?',
    a: 'Yes. A team can have up to four admins, including pending invitations, so race and roster management can be shared.',
  },
  {
    q: 'Can we reuse our existing crew list?',
    a: 'Yes. Team admins can add crew in bulk during onboarding and manage the roster as the season changes.',
  },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function RouteButton({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  return <button type="button" className={className} onClick={() => navigate(to)}>{children}</button>
}

function ScrollButton({ to, className, children }: { to: string; className: string; children: ReactNode }) {
  return <button type="button" className={className} onClick={() => scrollTo(to)}>{children}</button>
}

function Wordmark({ className = '', to = '/mockups' }: { className?: string; to?: string }) {
  return (
    <RouteButton to={to} className={`mock-wordmark ${className}`}>
      <span className="mock-wordmark-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>Crewlist</span>
    </RouteButton>
  )
}

function MockupSwitcher({ active }: { active: 'maritime' | 'software' | 'racing' }) {
  return (
    <nav className="mock-switcher" aria-label="Homepage mockups">
      {(['maritime', 'software', 'racing'] as const).map((item, index) => (
        <button
          type="button"
          key={item}
          className={active === item ? 'is-active' : ''}
          aria-current={active === item ? 'page' : undefined}
          onClick={() => navigate(`/mockups/${item}`)}
        >
          <span>0{index + 1}</span>{item}
        </button>
      ))}
    </nav>
  )
}

function FaqList({ className = '' }: { className?: string }) {
  return (
    <div className={`mock-faq-list ${className}`}>
      {faqs.map(item => (
        <details key={item.q} className="mock-faq">
          <summary><span>{item.q}</span><Plus className="mock-faq-icon" aria-hidden="true" /></summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  )
}

function ProductPreview({ dark = false, wordmarkTo = '/mockups' }: { dark?: boolean; wordmarkTo?: string }) {
  return (
    <div className={`product-preview ${dark ? 'product-preview-dark' : ''}`} aria-label="Illustrative Crewlist race schedule">
      <div className="product-preview-top">
        <Wordmark to={wordmarkTo} />
        <span className="product-preview-team">Scallywag by Crewlist</span>
      </div>
      <div className="product-preview-body">
        <div className="product-preview-heading">
          <div><span className="product-preview-kicker">NEXT RACE</span><h3>Harbour Series · Race 4</h3></div>
          <span className="product-preview-open">Sign-ups open</span>
        </div>
        <div className="product-preview-meta"><span>Saturday, 28 November</span><span>13:30 · Victoria Harbour</span></div>
        <div className="product-preview-crew">
          <div><span>Available</span><strong>8</strong></div>
          <div><span>Not available</span><strong>2</strong></div>
          <div><span>Awaiting reply</span><strong>4</strong></div>
        </div>
        <div className="product-preview-list">
          {['Alex · Helm', 'Morgan · Trim', 'Sam · Bow'].map((name, index) => (
            <div key={name}><span className="product-avatar">{name.slice(0, 1)}</span><span>{name}</span><span className="product-status">{index === 2 ? 'Pending' : 'Available'}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PhotoCredit({ href, children, className = '', mockup = true }: { href: string; children: ReactNode; className?: string; mockup?: boolean }) {
  return <a className={`mock-photo-credit ${className}`} href={href} target="_blank" rel="noreferrer">{mockup ? 'Mockup photography: ' : 'Photography: '}{children}</a>
}

export function MockupIndex() {
  return (
    <main className="mock-index">
      <Wordmark />
      <div className="mock-index-content">
        <p className="mock-index-label">DESIGN PREVIEWS · LOCAL ONLY</p>
        <h1>Homepage directions. One shared system.</h1>
        <p>Compare the approved homepage direction, then test the reusable interface foundation planned for the phased rollout.</p>
        <div className="mock-index-options">
          <RouteButton to="/mockups/maritime" className="mock-index-option">
            <span>01</span><strong>Maritime editorial</strong><small>Understated, photographic, considered</small><ArrowUpRight aria-hidden="true" />
          </RouteButton>
          <RouteButton to="/mockups/software" className="mock-index-option">
            <span>02</span><strong>Modern software</strong><small>Crisp, product-led, direct</small><ArrowUpRight aria-hidden="true" />
          </RouteButton>
          <RouteButton to="/mockups/racing" className="mock-index-option">
            <span>03</span><strong>Offshore racing</strong><small>Bold, dark, kinetic</small><ArrowUpRight aria-hidden="true" />
          </RouteButton>
          <RouteButton to="/mockups/foundation" className="mock-index-option">
            <span>04</span><strong>Interface foundation</strong><small>Step 1 · Interactive components and states</small><ArrowUpRight aria-hidden="true" />
          </RouteButton>
        </div>
      </div>
    </main>
  )
}

export function MaritimeHome() {
  return (
    <div className="maritime-page">
      <MockupSwitcher active="maritime" />
      <header className="maritime-header">
        <Wordmark />
        <nav aria-label="Main navigation">
          <ScrollButton to="maritime-product" className="mock-nav-link">Product</ScrollButton>
          <ScrollButton to="maritime-how" className="mock-nav-link">How it works</ScrollButton>
          <ScrollButton to="maritime-sailors" className="mock-nav-link">For sailors</ScrollButton>
        </nav>
        <RouteButton to="/login" className="mock-nav-link maritime-signin">Sign in</RouteButton>
      </header>

      <main>
        <section className="maritime-hero">
          <div className="maritime-hero-copy">
            <p className="maritime-overline">CREW SIGN-UPS FOR SAILING TEAMS</p>
            <h1>Crew sign-ups,<br /><em>sorted</em> before<br />you cast off.</h1>
            <p className="maritime-deck">Publish races, share one team link and see who is available—without spreadsheets or another account for your sailors.</p>
            <div className="maritime-actions">
              <RouteButton to="/join" className="maritime-primary">Start your team <ArrowRight aria-hidden="true" /></RouteButton>
              <ScrollButton to="maritime-product" className="maritime-text-link">See the product <ArrowUpRight aria-hidden="true" /></ScrollButton>
            </div>
          </div>
          <figure className="maritime-hero-image">
            <img src={editorialPhoto} alt="A classic sailing yacht heeling with its crew working on deck" />
            <figcaption><span>THE WORK BEFORE THE START LINE</span><span>01 / CREWLIST</span></figcaption>
          </figure>
        </section>

        <section className="maritime-manifesto">
          <p>LESS TIME CHASING. MORE TIME SAILING.</p>
          <h2>Your crew should know where to be. Your organiser should know who is coming.</h2>
          <div className="maritime-manifesto-notes">
            <span>One current race schedule</span><span>Clear crew availability</span><span>No sailor accounts</span>
          </div>
        </section>

        <section id="maritime-product" className="maritime-product">
          <div className="maritime-section-copy">
            <p className="maritime-overline">THE TEAM VIEW</p>
            <h2>A race sheet your whole crew can understand.</h2>
            <p>Keep races, availability and crew details together. Admins get the operational view; sailors get a direct path to sign up.</p>
            <ul>
              <li><Check aria-hidden="true" />Publish and manage upcoming races</li>
              <li><Check aria-hidden="true" />See available, unavailable and pending crew</li>
              <li><Check aria-hidden="true" />Share race and roster work across up to four admins</li>
            </ul>
          </div>
          <ProductPreview />
        </section>

        <section id="maritime-how" className="maritime-how">
          <p className="maritime-overline">FROM SETUP TO START LINE</p>
          <h2>Three steps. One link.</h2>
          <div className="maritime-steps">
            <article><span>01</span><h3>Create your team</h3><p>Choose your team name and link, then bring in your crew list.</p></article>
            <article><span>02</span><h3>Publish your races</h3><p>Add dates and race details so everyone works from the same schedule.</p></article>
            <article><span>03</span><h3>Share with your crew</h3><p>Send the team link through your existing channel. Sailors sign up without registering.</p></article>
          </div>
        </section>

        <section id="maritime-sailors" className="maritime-sailors">
          <div><p className="maritime-overline">FOR SAILORS</p><h2>No new password between your crew and the water.</h2></div>
          <p>Looking for your team? Open the link its organiser sent you. Crewlist is deliberately unlisted, so your team stays easy to reach without becoming a public directory entry.</p>
        </section>

        <section id="maritime-faq" className="maritime-faq-section">
          <div><p className="maritime-overline">PRACTICAL DETAILS</p><h2>Before you gather the crew.</h2></div>
          <FaqList />
        </section>

        <section className="maritime-final">
          <p>YOUR NEXT RACE STARTS HERE</p>
          <h2>Give your crew one clear place to say yes.</h2>
          <RouteButton to="/join" className="maritime-primary">Start your team <ArrowRight aria-hidden="true" /></RouteButton>
        </section>
      </main>

      <footer className="maritime-footer">
        <Wordmark />
        <span>Crew sign-ups for sailing teams.</span>
        <div><RouteButton to="/login" className="mock-nav-link">Sign in</RouteButton><RouteButton to="/join" className="mock-nav-link">Start a team</RouteButton></div>
        <PhotoCredit href="https://classicyachtinfo.com/category/visual/photography/">Classic Yacht Info</PhotoCredit>
      </footer>
    </div>
  )
}

export function SoftwareHome({ production = false }: { production?: boolean }) {
  const homePath = production ? '/' : '/mockups'
  return (
    <div className="software-page">
      {!production && <MockupSwitcher active="software" />}
      <header className="software-header">
        <Wordmark to={homePath} />
        <nav aria-label="Main navigation">
          <ScrollButton to="software-product" className="mock-nav-link">Overview</ScrollButton>
          <ScrollButton to="software-workflow" className="mock-nav-link">Workflow</ScrollButton>
          <ScrollButton to="software-faq" className="mock-nav-link">FAQ</ScrollButton>
        </nav>
        <RouteButton to="/login" className="software-signin">Sign in</RouteButton>
      </header>

      <main className="software-layout">
        <div className="software-main">
          <section className="software-hero">
            <div className="software-label"><span />CREW OPERATIONS, SIMPLIFIED</div>
            <h1>Crew management that keeps race day moving.</h1>
            <p>Crewlist gives sailing-team organisers one live schedule for races and availability. Share a link, collect sign-ups and stop reconstructing the crew from group-chat replies.</p>
            <RouteButton to="/join" className="software-primary software-hero-cta">Start your team <ArrowRight aria-hidden="true" /></RouteButton>
            <ScrollButton to="software-product" className="software-text-link">Explore the team view <ArrowRight aria-hidden="true" /></ScrollButton>
          </section>

          <section id="software-product" className="software-product">
            <ProductPreview wordmarkTo={homePath} />
            <p className="software-caption">A shared race schedule, with availability visible before you commit the crew.</p>
          </section>

          <section className="software-feature-block">
            <p className="software-section-label">BUILT FOR THE ORGANISER</p>
            <h2>One operational view. Fewer places to check.</h2>
            <div className="software-feature-rows">
              <article><span>01</span><div><h3>Race schedule</h3><p>Publish upcoming races and keep dates, times and locations together.</p></div></article>
              <article><span>02</span><div><h3>Crew availability</h3><p>See who is available, unavailable or still to respond without chasing individual replies.</p></div></article>
              <article><span>03</span><div><h3>Shared administration</h3><p>Invite co-admins so one person does not have to carry every update.</p></div></article>
              <article><span>04</span><div><h3>Direct sailor access</h3><p>Your crew uses the link you already share. No account creation slows them down.</p></div></article>
            </div>
          </section>

          <section id="software-workflow" className="software-workflow">
            <p className="software-section-label">A SHORTER PATH TO A FULL CREW</p>
            <h2>From team setup to sign-up in one workflow.</h2>
            <ol>
              <li><strong>Create the team.</strong><span>Name it, reserve its unique link and add your crew.</span></li>
              <li><strong>Publish races.</strong><span>Give sailors the current schedule and sign-up window.</span></li>
              <li><strong>Share once.</strong><span>Send the same direct link through WhatsApp, email or your crew channel.</span></li>
              <li><strong>Build the race crew.</strong><span>Use live availability instead of reconciling scattered replies.</span></li>
            </ol>
          </section>

          <section className="software-privacy">
            <span className="software-privacy-mark" aria-hidden="true">/</span>
            <div><p className="software-section-label">UNLISTED BY DESIGN</p><h2>Your team link is for your crew, not a public directory.</h2><p>Crewlist gives each team its own direct address without asking sailors to browse or search for other organisations.</p></div>
          </section>

          <section id="software-faq" className="software-faq-section">
            <p className="software-section-label">COMMON QUESTIONS</p>
            <h2>What your team needs to know.</h2>
            <FaqList />
          </section>
        </div>

        <aside className="software-sidebar">
          <div className="software-sidebar-card">
            <Wordmark to={homePath} />
            <p>Everything your team needs to organise race sign-ups.</p>
            <ul><li><Check aria-hidden="true" />No sailor accounts</li><li><Check aria-hidden="true" />Direct team links</li><li><Check aria-hidden="true" />Up to four admins</li><li><Check aria-hidden="true" />Bulk crew setup</li></ul>
            <RouteButton to="/join" className="software-primary">Start your team <ArrowRight aria-hidden="true" /></RouteButton>
            <small>Team organisers only. Sailors can use their team link directly.</small>
          </div>
        </aside>
      </main>

      <figure className="software-racing-banner">
        <img src={racingPhoto} alt="An offshore racing yacht driving through rough water" />
        <PhotoCredit href="https://worth.com/american-sailors-offshore-challenges/" mockup={!production}>Worth</PhotoCredit>
      </figure>

      <section className="software-final">
        <div><p className="software-section-label">READY WHEN YOUR CREW IS</p><h2>Put the next race on one clear list.</h2></div>
        <RouteButton to="/join" className="software-primary">Start your team <ArrowRight aria-hidden="true" /></RouteButton>
      </section>
      <footer className="software-footer"><Wordmark to={homePath} /><span>Direct team links. Clear crew availability.</span><RouteButton to="/login" className="mock-nav-link">Sign in</RouteButton></footer>
    </div>
  )
}

export function RacingHome() {
  return (
    <div className="racing-page">
      <MockupSwitcher active="racing" />
      <header className="racing-header">
        <Wordmark />
        <nav aria-label="Main navigation">
          <ScrollButton to="racing-system" className="mock-nav-link">SYSTEM</ScrollButton>
          <ScrollButton to="racing-workflow" className="mock-nav-link">WORKFLOW</ScrollButton>
          <ScrollButton to="racing-faq" className="mock-nav-link">FAQ</ScrollButton>
        </nav>
        <RouteButton to="/join" className="racing-nav-cta">START A TEAM <ArrowUpRight aria-hidden="true" /></RouteButton>
      </header>

      <main>
        <section className="racing-hero">
          <div className="racing-hero-top"><span>CREW SIGN-UPS / RACE MANAGEMENT</span><span>BUILT FOR TEAM ORGANISERS</span></div>
          <h1>CREWLIST</h1>
          <div className="racing-hero-bottom">
            <p>Get the crew together.<br />Get to the start line.</p>
            <div><span>One live race schedule. One direct team link. No accounts for sailors.</span><RouteButton to="/join" className="racing-primary">START YOUR TEAM <ArrowRight aria-hidden="true" /></RouteButton></div>
          </div>
        </section>

        <section id="racing-system" className="racing-panels" aria-label="Crewlist workflow">
          <article className="racing-panel racing-panel-orange"><span>01 / PUBLISH</span><h2>RACES</h2><p>Put the season on one current schedule.</p></article>
          <article className="racing-panel racing-panel-yellow"><span>02 / SHARE</span><h2>THE LINK</h2><p>Reach your crew where they already talk.</p></article>
          <article className="racing-panel racing-panel-green"><span>03 / COLLECT</span><h2>ANSWERS</h2><p>See availability without chasing replies.</p></article>
          <article className="racing-panel racing-panel-blue"><span>04 / RACE</span><h2>TOGETHER</h2><p>Build the crew from one clear view.</p></article>
        </section>

        <section className="racing-photo">
          <img src={racingPhoto} alt="An offshore racing yacht driving through rough water" />
          <div className="racing-photo-overlay"><span>THE START LINE DOES NOT WAIT.</span><strong>NEITHER SHOULD YOUR CREW LIST.</strong></div>
          <PhotoCredit href="https://worth.com/american-sailors-offshore-challenges/">Worth</PhotoCredit>
        </section>

        <section className="racing-product">
          <div className="racing-product-copy"><p className="racing-label">RACE-DAY CLARITY</p><h2>Know who is in before you leave the dock.</h2><p>One operational view for organisers. One frictionless sign-up for sailors. No spreadsheet archaeology required.</p><ul><li>Race dates and details</li><li>Crew availability</li><li>Shared team administration</li></ul></div>
          <ProductPreview dark />
        </section>

        <section id="racing-workflow" className="racing-workflow">
          <p className="racing-label">YOUR TEAM / YOUR WORKFLOW</p>
          <h2>SET UP. SHARE. SIGN UP.</h2>
          <div>
            <article><span>01</span><h3>Create your team</h3><p>Reserve the team link and bring in your crew.</p></article>
            <article><span>02</span><h3>Publish the schedule</h3><p>Give every sailor the same race information.</p></article>
            <article><span>03</span><h3>Send one link</h3><p>Sailors respond directly—no new login required.</p></article>
          </div>
        </section>

        <section className="racing-unlisted"><span>■</span><p>UNLISTED BY DESIGN</p><h2>Your crew does not need to search. Send them straight to your team.</h2></section>

        <section id="racing-faq" className="racing-faq-section"><div><p className="racing-label">RACEDAY QUESTIONS</p><h2>THE DETAILS.</h2></div><FaqList /></section>

        <section className="racing-final"><p>NEXT RACE / FULL CREW</p><h2>MAKE THE<br />START LINE.</h2><RouteButton to="/join" className="racing-primary">START YOUR TEAM <ArrowRight aria-hidden="true" /></RouteButton></section>
      </main>

      <footer className="racing-footer"><Wordmark /><span>CREW SIGN-UPS FOR SAILING TEAMS</span><RouteButton to="/login" className="racing-signin">SIGN IN <ArrowUpRight aria-hidden="true" /></RouteButton></footer>
    </div>
  )
}
