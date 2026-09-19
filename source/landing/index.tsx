import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Wallet,
  PiggyBank,
  Target,
  CreditCard,
  TrendingUp,
  Moon,
  Instagram,
} from "lucide-react";
import heroNight from "@/assets/hero-night.jpg";
import nightTable from "@/assets/night-table.jpg";
import goldenSea from "@/assets/golden-sea.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Life Lately — dinheiro no seu ritmo" },
      {
        name: "description",
        content:
          "Gestão financeira para profissionais autônomos que vivem intensamente. Ganhos, cofrinhos, metas e compromissos com a elegância de uma noite inesquecível.",
      },
      { property: "og:title", content: "Life Lately — dinheiro no seu ritmo" },
      {
        property: "og:description",
        content:
          "A vida financeira de quem trabalha por conta própria, com o brilho de quem sabe viver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const APP_URL = "/app/";

const features = [
  {
    icon: Wallet,
    title: "Ganhos",
    text: "Cada cachê, cada job, cada noite bem paga — registrada em segundos, com o total do mês sempre à vista.",
  },
  {
    icon: PiggyBank,
    title: "Cofrinhos",
    text: "Separe o que é seu do que é sonho. Viagem a Paris, câmera nova, reserva de luxo: cada um no seu lugar.",
  },
  {
    icon: Target,
    title: "Metas",
    text: "Planos com data marcada e progresso visível. Você sabe exatamente quanto falta para o próximo capítulo.",
  },
  {
    icon: CreditCard,
    title: "Compromissos",
    text: "Sem surpresas no fim da noite. Parcelas organizadas, vencimentos claros, cabeça leve.",
  },
];

const days = [
  { d: "S", v: 0 },
  { d: "T", v: 62 },
  { d: "Q", v: 78 },
  { d: "Q", v: 55 },
  { d: "S", v: 84 },
  { d: "S", v: 100 },
  { d: "D", v: 0 },
];

function Landing() {
  return (
    <div className="bg-gradient-night min-h-screen overflow-x-hidden">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="glass mx-auto mt-4 flex w-[min(92%,72rem)] items-center justify-between rounded-full px-5 py-3">
          <a href="#" className="flex items-center gap-3">
            <span className="bg-gradient-rose shadow-rose grid size-9 place-items-center rounded-full">
              <Sparkles className="size-4 text-primary-foreground" />
            </span>
            <span className="leading-tight">
              <span className="font-display block text-lg font-semibold">Life Lately</span>
              <span className="block text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
                dinheiro no seu ritmo
              </span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#experiencia" className="transition-colors hover:text-foreground">
              Experiência
            </a>
            <a href="#app" className="transition-colors hover:text-foreground">
              O app
            </a>
            <a href="#manifesto" className="transition-colors hover:text-foreground">
              Manifesto
            </a>
          </nav>
          <a
            href={APP_URL}
            className="bg-gradient-rose shadow-rose inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Acessar
            <ArrowRight className="size-4" />
          </a>
        </div>
      </header>

      {/* HERO */}
      <section className="grain relative flex min-h-screen items-end">
        <img
          src={heroNight}
          alt="Mulher em terraço parisiense à noite com a Torre Eiffel iluminada"
          width={1408}
          height={1024}
          className="absolute inset-0 size-full object-cover object-[65%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

        <div className="relative mx-auto w-[min(92%,72rem)] pt-40 pb-20 md:pb-28">
          <p className="eyebrow animate-fade-up">Seu dinheiro, no seu ritmo</p>
          <h1 className="animate-fade-up mt-5 max-w-3xl text-5xl leading-[1.02] [animation-delay:120ms] md:text-7xl lg:text-8xl">
            A vida acontece.
            <br />
            <em className="text-gradient-gold animate-shimmer font-normal italic">
              Seu dinheiro acompanha.
            </em>
          </h1>
          <p className="animate-fade-up mt-7 max-w-xl text-base leading-relaxed text-muted-foreground [animation-delay:240ms] md:text-lg">
            Life Lately é a gestão financeira de quem trabalha por conta própria e vive
            intensamente. Ganhos, cofrinhos, metas e compromissos — organizados com a mesma
            elegância com que você escolhe o look da noite.
          </p>
          <div className="animate-fade-up mt-10 flex flex-wrap items-center gap-4 [animation-delay:360ms]">
            <a
              href={APP_URL}
              className="bg-gradient-rose shadow-rose inline-flex items-center gap-3 rounded-full px-8 py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Acessar o app
              <ArrowRight className="size-5" />
            </a>
            <a
              href="#experiencia"
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-6 py-4 text-sm text-gold transition-colors hover:bg-gold/10"
            >
              Conhecer a experiência
            </a>
          </div>
          <div className="animate-fade-up mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-border pt-8 [animation-delay:480ms]">
            {[
              ["100%", "feito para autônomos"],
              ["1 tela", "para o mês inteiro"],
              ["0", "planilhas na madrugada"],
            ].map(([n, l]) => (
              <div key={l}>
                <p className="font-display text-3xl text-gold md:text-4xl">{n}</p>
                <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTO STRIP */}
      <section id="manifesto" className="border-y border-border">
        <div className="mx-auto grid w-[min(92%,72rem)] gap-10 py-20 md:grid-cols-[1fr_1.3fr] md:items-center md:py-28">
          <p className="eyebrow">Manifesto</p>
          <h2 className="text-3xl leading-snug md:text-5xl">
            Você não precisa escolher entre{" "}
            <em className="text-rose-soft italic">viver bem</em> e{" "}
            <em className="text-gold italic">estar bem</em>. Precisa de um lugar onde as
            duas coisas se encontram.
          </h2>
        </div>
      </section>

      {/* EXPERIENCE */}
      <section id="experiencia" className="mx-auto w-[min(92%,72rem)] py-24 md:py-32">
        <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="relative">
            <img
              src={nightTable}
              alt="Mesa de mármore em rooftop com taça de champanhe e bolsa preta"
              width={1024}
              height={1280}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-3xl object-cover"
            />
            <div className="glass shadow-gold absolute -right-4 -bottom-6 w-64 rounded-2xl p-5 md:-right-10">
              <p className="text-xs text-muted-foreground">Livre para você</p>
              <p className="font-display mt-1 text-3xl text-emerald">R$ 633,12</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                depois dos cofrinhos e das metas do mês
              </p>
            </div>
          </div>
          <div>
            <p className="eyebrow">A experiência</p>
            <h2 className="mt-4 text-4xl leading-tight md:text-5xl">
              Tudo o que entra, tudo o que brilha, tudo o que fica.
            </h2>
            <p className="mt-6 text-muted-foreground">
              Um app pensado para quem não tem salário fixo — mas tem estilo fixo. Quatro
              pilares, uma única visão do seu mês.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="group rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-rose/50"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-rose/15 text-rose-soft transition-colors group-hover:bg-rose group-hover:text-primary-foreground">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="mt-4 text-xl">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* APP PREVIEW */}
      <section id="app" className="relative overflow-hidden py-24 md:py-32">
        <div className="pointer-events-none absolute top-1/2 left-1/2 size-[48rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose/15 blur-[140px]" />
        <div className="relative mx-auto grid w-[min(92%,72rem)] items-center gap-16 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="animate-float mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-card p-5 shadow-rose">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.25em] text-gold uppercase">
                    Seu dinheiro, no seu ritmo
                  </p>
                  <p className="font-display mt-1 text-2xl">Oi.</p>
                </div>
                <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  set. de 2026
                </span>
              </div>
              <div className="bg-gradient-rose mt-5 rounded-2xl p-5 text-primary-foreground">
                <p className="text-xs opacity-80">Entrou neste mês</p>
                <p className="font-display mt-1 text-4xl font-semibold">R$ 3.450,00</p>
                <button className="mt-4 w-full rounded-xl bg-background/20 py-2.5 text-sm font-semibold backdrop-blur">
                  + Ganhei
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-[11px] text-muted-foreground">Nos cofrinhos</p>
                  <p className="font-display mt-1 text-xl">R$ 3.450,00</p>
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-[11px] text-muted-foreground">Livre para você</p>
                  <p className="font-display mt-1 text-xl text-emerald">R$ 633,12</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Esta semana</span>
                  <span className="text-rose-soft">R$ 3.450,00</span>
                </div>
                <div className="mt-4 flex h-20 items-end justify-between gap-2">
                  {days.map(({ d, v }, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div
                        className={`w-full rounded-full ${v === 100 ? "bg-rose" : "bg-rose/40"}`}
                        style={{ height: v ? `${Math.round(v * 0.6)}px` : "3px" }}
                      />
                      <span className="text-[10px] text-muted-foreground">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow">O app</p>
            <h2 className="mt-4 text-4xl leading-tight md:text-5xl">
              Uma tela. O mês inteiro. <em className="text-gold italic">Sem drama.</em>
            </h2>
            <p className="mt-6 text-muted-foreground">
              Abra, registre o que ganhou e veja na hora quanto está guardado, quanto está
              comprometido e quanto é livre para você. Simples como pedir mais uma taça.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                [TrendingUp, "Visão semanal dos ganhos, dia a dia"],
                [Moon, "Feito para rotinas que não seguem horário comercial"],
                [Sparkles, "Design rosé que combina com a sua vibe"],
              ].map(([Icon, t]: any, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full border border-gold/40 text-gold">
                    <Icon className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <a
              href={APP_URL}
              className="bg-gradient-rose shadow-rose mt-10 inline-flex items-center gap-3 rounded-full px-8 py-4 font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Acessar o app
              <ArrowRight className="size-5" />
            </a>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="mx-auto w-[min(92%,72rem)] py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <img
            src={goldenSea}
            alt="Silhueta feminina sobre rochas ao pôr do sol dourado"
            width={1024}
            height={1280}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-3xl object-cover"
          />
          <div>
            <p className="eyebrow">De quem usa</p>
            <blockquote className="font-display mt-6 text-3xl leading-snug md:text-5xl">
              “Eu queria um app que entendesse que{" "}
              <em className="text-rose-soft italic">a vida acontece à noite</em>, em
              viagens, em cachês que chegam quando chegam. Que fosse bonito de abrir — e
              que me deixasse livre pra viver.”
            </blockquote>
            <p className="mt-8 text-sm tracking-[0.2em] text-gold uppercase">Marina Costa</p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="grain relative overflow-hidden border-t border-border">
        <div className="pointer-events-none absolute -top-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[140px]" />
        <div className="relative mx-auto w-[min(92%,72rem)] py-28 text-center md:py-40">
          <p className="eyebrow">Life Lately</p>
          <h2 className="mx-auto mt-5 max-w-3xl text-5xl leading-[1.05] md:text-7xl">
            Brilhe hoje. <em className="text-gradient-gold animate-shimmer italic">Tenha amanhã.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-muted-foreground">
            Entre e comece a organizar o seu mês em menos tempo do que leva para escolher em qual
            restaurante você vai comer hoje.
          </p>
          <a
            href={APP_URL}
            className="bg-gradient-rose shadow-rose mt-10 inline-flex items-center gap-3 rounded-full px-10 py-5 text-lg font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            Acessar o app
            <ArrowRight className="size-5" />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-[min(92%,72rem)] flex-col items-center gap-6 py-10 text-center text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-rose grid size-7 place-items-center rounded-full">
              <Sparkles className="size-3 text-primary-foreground" />
            </span>
            <span className="font-display text-base text-foreground">Life Lately</span>
            <span>© 2026</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p>
              developed by <span className="text-gold">Osyra Team</span>
            </p>
          </div>
          <a
            href="#"
            aria-label="Instagram"
            className="inline-flex size-9 items-center justify-center rounded-full border border-border transition-colors hover:border-rose hover:text-rose-soft"
          >
            <Instagram className="size-4" />
          </a>
        </div>
      </footer>
    </div>
  );
}
