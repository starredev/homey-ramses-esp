import {
  ArrowRight,
  BellRing,
  Gauge,
  Radio,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
  ThermometerSun,
  Wind,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { i18n } from '@/lib/i18n';
import { basePath, githubUrl, testVersionUrl } from '@/lib/shared';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

type Feature = { icon: ReactNode; title: string; text: string; href: string };
type Step = { title: string; text: string };

interface Copy {
  badge: string;
  title: string;
  lead: string;
  start: string;
  install: string;
  points: [string, string, string];
  busTitle: string;
  busLive: string;
  bus: { source: string; role: string; value: string; tone: 'emerald' | 'sky' | 'amber' }[];
  featuresTitle: string;
  featuresLead: string;
  readMore: string;
  features: Feature[];
  stepsTitle: string;
  stepsLead: string;
  stepsLink: string;
  steps: Step[];
  gatewaysTitle: string;
  gatewaysLead: string;
  gateways: { name: string; chip: string; note: string }[];
  gatewaysLink: string;
  footer: string;
}

function copyFor(lang: string): Copy {
  const docs = (page: string) => `/${lang}/docs/${page}`;

  if (lang === 'nl') {
    return {
      badge: 'Homey-app · 868 MHz RAMSES II · lokaal',
      title: 'Je ventilatie in Homey, met een ramses_esp.',
      lead: 'Bedien je Orcon, Itho, Vasco of ClimaRad vanuit Homey. Lees CO₂, vocht, temperaturen en filterstatus, gebruik je bestaande remotes als flowtrigger en laat Homey zelf een CO₂-sensor spelen.',
      start: 'Aan de slag',
      install: 'Installeren',
      points: ['Geen cloud, geen Home Assistant', 'Live busweergave', 'Virtuele CO₂-sensor'],
      busTitle: 'Busweergave',
      busLive: 'live',
      bus: [
        { source: '29:233244', role: 'Ventilatie-unit', value: 'Modus auto · 31D9', tone: 'emerald' },
        { source: '37:215483', role: 'Virtuele CO₂-sensor', value: '812 ppm · 1298', tone: 'sky' },
        { source: '29:173894', role: 'Remote', value: 'Knop Hoog · 22F1', tone: 'amber' },
        { source: '37:044778', role: 'CO2 15RF', value: 'Vraag 42 % · 31E0', tone: 'sky' },
      ],
      featuresTitle: 'Alles wat je ventilatie kan, in Homey',
      featuresLead: 'De app praat via MQTT met je ramses_esp en vertaalt elk pakket op de bus naar apparaten, waarden en flows.',
      readMore: 'Lees meer',
      features: [
        { icon: <Wind className="size-4" />, title: 'Ventilatie-unit', text: 'Ventilatiestand instellen, boost starten, filterteller resetten. CO₂, vocht, temperaturen en bypass zodra de unit ze meldt.', href: docs('ventilation-unit') },
        { icon: <Radio className="size-4" />, title: 'Remotes en sensoren', text: 'Een fysieke remote wordt een flowtrigger. Ruimtesensoren worden Homey-apparaten met CO₂, vocht en batterij.', href: docs('remotes-and-sensors') },
        { icon: <ThermometerSun className="size-4" />, title: 'Virtuele CO₂-sensor', text: 'Homey bindt zich als CO₂-sensor aan je unit en geeft de waarden van elke Homey-sensor door. De unit in auto ventileert erop.', href: docs('homey-co2-sensor') },
        { icon: <Workflow className="size-4" />, title: 'Flows', text: 'Triggers voor ventilatiestand, boost, knoppen, nieuwe apparaten en elk pakket op de bus, plus ruwe frames versturen.', href: docs('flows') },
        { icon: <Gauge className="size-4" />, title: 'Busweergave', text: 'Live verkeer met gedecodeerde waarden, de apparatenvinder en een formulier om zelf een frame te sturen.', href: docs('dashboard') },
        { icon: <SlidersHorizontal className="size-4" />, title: 'Protocol', text: 'Hoe RAMSES II werkt, welke codes de app leest en verstuurt, en hoe binden werkt.', href: docs('protocol') },
      ],
      stepsTitle: 'In een kwartier aan de praat',
      stepsLead: 'Een ramses_esp, de MQTT Broker-app en deze app.',
      stepsLink: 'Installatiegids',
      steps: [
        { title: 'Gateway instellen', text: 'Wifi en MQTT op je ramses_esp, eenmalig via PuTTY.' },
        { title: 'App installeren', text: 'Installeer RAMSES ESP op je Homey Pro (2023) of Homey Pro mini.' },
        { title: 'Apparaten toevoegen', text: 'Homey vindt de gateway en toont alles wat hij op de bus hoort.' },
      ],
      gatewaysTitle: 'Geteste gateways',
      gatewaysLead: 'Beide worden geleverd met de juiste firmware. Je stelt alleen wifi en MQTT in.',
      gateways: [
        { name: 'Elecram Sub-GHz Bridge', chip: 'ESP32-C6 + CC1101', note: 'ramses_esp_c6' },
        { name: 'Indalo-Tech RAMSES_ESP', chip: 'ESP32-S3 + CC1101', note: 'ramses_esp' },
      ],
      gatewaysLink: 'Welke gateway?',
      footer: 'MIT-licentie · Onofficieel communityproject, niet gemaakt of goedgekeurd door de fabrikanten of de makers van ramses_esp.',
    };
  }

  return {
    badge: 'Homey app · 868 MHz RAMSES II · local only',
    title: 'Your ventilation in Homey, with a ramses_esp.',
    lead: 'Control your Orcon, Itho, Vasco or ClimaRad from Homey. Read CO₂, humidity, temperatures and filter status, use your existing remotes as flow triggers and let Homey play a CO₂ sensor of its own.',
    start: 'Get started',
    install: 'Install',
    points: ['No cloud, no Home Assistant', 'Live bus view', 'Virtual CO₂ sensor'],
    busTitle: 'Bus view',
    busLive: 'live',
    bus: [
      { source: '29:233244', role: 'Ventilation unit', value: 'Mode auto · 31D9', tone: 'emerald' },
      { source: '37:215483', role: 'Virtual CO₂ sensor', value: '812 ppm · 1298', tone: 'sky' },
      { source: '29:173894', role: 'Remote', value: 'High button · 22F1', tone: 'amber' },
      { source: '37:044778', role: 'CO2 15RF', value: 'Demand 42 % · 31E0', tone: 'sky' },
    ],
    featuresTitle: 'Everything your ventilation can do, in Homey',
    featuresLead: 'The app talks to your ramses_esp over MQTT and turns every packet on the bus into devices, values and flows.',
    readMore: 'Read more',
    features: [
      { icon: <Wind className="size-4" />, title: 'Ventilation unit', text: 'Set the fan mode, start a boost, reset the filter counter. CO₂, humidity, temperatures and bypass as soon as the unit reports them.', href: docs('ventilation-unit') },
      { icon: <Radio className="size-4" />, title: 'Remotes and sensors', text: 'A physical remote becomes a flow trigger. Room sensors become Homey devices with CO₂, humidity and battery.', href: docs('remotes-and-sensors') },
      { icon: <ThermometerSun className="size-4" />, title: 'Virtual CO₂ sensor', text: 'Homey binds to your unit as a CO₂ sensor and passes on the values of any Homey sensor. The unit in auto ventilates on them.', href: docs('homey-co2-sensor') },
      { icon: <Workflow className="size-4" />, title: 'Flows', text: 'Triggers for fan mode, boost, buttons, new devices and every packet on the bus, plus sending raw frames.', href: docs('flows') },
      { icon: <Gauge className="size-4" />, title: 'Bus view', text: 'Live traffic with decoded values, the device finder and a form to send a frame yourself.', href: docs('dashboard') },
      { icon: <SlidersHorizontal className="size-4" />, title: 'Protocol', text: 'How RAMSES II works, which codes the app reads and sends, and how binding works.', href: docs('protocol') },
    ],
    stepsTitle: 'Up and running in fifteen minutes',
    stepsLead: 'A ramses_esp, the MQTT Broker app and this app.',
    stepsLink: 'Installation guide',
    steps: [
      { title: 'Set up the gateway', text: 'Wi-Fi and MQTT on your ramses_esp, once, through PuTTY.' },
      { title: 'Install the app', text: 'Install RAMSES ESP on your Homey Pro (2023) or Homey Pro mini.' },
      { title: 'Add devices', text: 'Homey finds the gateway and lists everything it hears on the bus.' },
    ],
    gatewaysTitle: 'Tested gateways',
    gatewaysLead: 'Both come with the right firmware. You only set up Wi-Fi and MQTT.',
    gateways: [
      { name: 'Elecram Sub-GHz Bridge', chip: 'ESP32-C6 + CC1101', note: 'ramses_esp_c6' },
      { name: 'Indalo-Tech RAMSES_ESP', chip: 'ESP32-S3 + CC1101', note: 'ramses_esp' },
    ],
    gatewaysLink: 'Which gateway?',
    footer: 'MIT licence · Unofficial community project, not made or endorsed by the manufacturers or by the ramses_esp authors.',
  };
}

const toneDot: Record<Copy['bus'][number]['tone'], string> = {
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  amber: 'bg-amber-500',
};

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  const t = copyFor(lang);

  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b">
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-fd-background px-3 py-1 text-xs font-medium text-fd-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t.badge}
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t.title}</h1>
            <p className="max-w-xl text-lg text-fd-muted-foreground text-pretty">{t.lead}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/${lang}/docs`}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-fd-primary px-5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
              >
                {t.start}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href={testVersionUrl}
                className="inline-flex h-10 items-center gap-2 rounded-md border bg-fd-background px-5 text-sm font-medium transition-colors hover:bg-fd-accent"
              >
                {t.install}
              </a>
              <a
                href={githubUrl}
                className="inline-flex h-10 items-center gap-2 rounded-md border bg-fd-background px-5 text-sm font-medium transition-colors hover:bg-fd-accent"
              >
                <GitHubIcon />
                GitHub
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> {t.points[0]}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RadioTower className="size-4" /> {t.points[1]}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BellRing className="size-4" /> {t.points[2]}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border bg-fd-card p-2 shadow-sm">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <RadioTower className="size-4 text-fd-muted-foreground" />
                {t.busTitle}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-fd-accent px-2.5 py-0.5 text-xs font-medium">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                {t.busLive}
              </span>
            </div>
            <ul className="divide-y">
              {t.bus.map((row) => (
                <li key={row.source} className="flex items-center gap-3 px-3 py-3">
                  <span className={`size-2 shrink-0 rounded-full ${toneDot[row.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.role}</div>
                    <div className="font-mono text-xs text-fd-muted-foreground">{row.source}</div>
                  </div>
                  <span className="shrink-0 rounded-md border bg-fd-background px-2 py-1 font-mono text-xs">{row.value}</span>
                </li>
              ))}
            </ul>
            <img
              src={`${basePath}/images/app.png`}
              alt=""
              className="mx-auto mt-2 block w-3/4 max-w-sm rounded-xl opacity-95"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">{t.featuresTitle}</h2>
          <p className="mt-2 text-fd-muted-foreground">{t.featuresLead}</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-fd-border sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map((feature) => (
            <Link key={feature.title} href={feature.href} className="group flex flex-col gap-3 bg-fd-background p-6 transition-colors hover:bg-fd-accent/50">
              <span className="inline-flex size-8 items-center justify-center rounded-md border bg-fd-card">{feature.icon}</span>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-fd-muted-foreground">{feature.text}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                {t.readMore} <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t bg-fd-card/40">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.stepsTitle}</h2>
            <p className="mt-2 text-fd-muted-foreground">{t.stepsLead}</p>
            <Link href={`/${lang}/docs/installation`} className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              {t.stepsLink} <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {t.steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-fd-background p-5">
                <span className="font-mono text-xs text-fd-muted-foreground">0{index + 1}</span>
                <h3 className="mt-2 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-fd-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t.gatewaysTitle}</h2>
            <p className="mt-2 text-fd-muted-foreground">{t.gatewaysLead}</p>
            <Link href={`/${lang}/docs/installation#which-gateway`} className="mt-6 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              {t.gatewaysLink} <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.gateways.map((gateway) => (
              <div key={gateway.name} className="flex items-center gap-4 rounded-xl border bg-fd-card p-5">
                <img src={`${basePath}/images/gateway.png`} alt="" width={56} height={56} className="rounded-lg" />
                <div className="min-w-0">
                  <h3 className="font-medium">{gateway.name}</h3>
                  <p className="text-sm text-fd-muted-foreground">{gateway.chip}</p>
                  <code className="mt-1 inline-block rounded bg-fd-muted px-1.5 py-0.5 text-xs">{gateway.note}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-fd-muted-foreground sm:flex-row sm:justify-between">
          <span>{t.footer}</span>
          <a href={githubUrl} className="hover:text-fd-foreground">
            starredev/homey-ramses-esp
          </a>
        </div>
      </footer>
    </main>
  );
}
