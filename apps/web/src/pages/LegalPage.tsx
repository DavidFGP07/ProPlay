import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { es } from '@/i18n/es'
import { DESCARGO_RIOT, legal, type SeccionLegal } from '@/i18n/legal'

// RNF-05 · Aviso de privacidad y terminos de uso: vista publica, sin sesion
export default function LegalPage() {
  const { usuario } = useAuth()
  const { hash } = useLocation()

  // Al entrar por /legal/privacidad#terminos (o al pulsar el indice), la vista
  // baja hasta esa seccion y lleva el foco a su encabezado.
  useEffect(() => {
    if (!hash) return
    const destino = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (!destino) return
    destino.scrollIntoView({ block: 'start' })
    destino.focus({ preventScroll: true })
  }, [hash])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to={usuario ? '/' : '/login'}
        className="inline-flex items-center gap-1.5 rounded-md text-xs text-slate-400 transition hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        <ArrowLeft size={14} aria-hidden />
        {usuario ? es.legal.volverApp : es.legal.volverLogin}
      </Link>

      <header className="mt-6">
        <Badge tono="violeta">
          <ShieldCheck size={11} aria-hidden />
          {es.legal.etiqueta}
        </Badge>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          {legal.titulo}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {es.legal.version(legal.version, legal.vigenteDesde)}
        </p>
      </header>

      <nav aria-label={es.legal.indice} className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {es.legal.indice}
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {legal.documentos.map((documento) => (
            <li key={documento.id}>
              <Link
                to={{ hash: documento.id }}
                className="inline-block rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-slate-200 transition hover:border-brand-500/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              >
                {documento.titulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {legal.documentos.map((documento) => (
        <Card key={documento.id} className="mt-8 p-5 sm:p-8">
          <article aria-labelledby={documento.id}>
            <h2
              id={documento.id}
              tabIndex={-1}
              className="scroll-mt-6 rounded-md text-xl font-semibold tracking-tight text-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
            >
              {documento.titulo}
            </h2>
            <div className="mt-5 space-y-6">
              {documento.secciones.map((seccion) => (
                <Seccion key={seccion.titulo} seccion={seccion} />
              ))}
            </div>
          </article>
        </Card>
      ))}

      <footer className="mt-8 border-t border-white/8 pt-5">
        <p className="text-[11px] leading-relaxed text-slate-500" lang="en">
          {DESCARGO_RIOT}
        </p>
      </footer>
    </main>
  )
}

function Seccion({ seccion }: { seccion: SeccionLegal }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-100">{seccion.titulo}</h3>
      {seccion.parrafos.map((parrafo) => (
        <p key={parrafo} className="mt-2 text-sm leading-relaxed text-slate-300">
          {parrafo}
        </p>
      ))}
      {seccion.lista && (
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-300">
          {seccion.lista.map((elemento) => (
            <li key={elemento}>{elemento}</li>
          ))}
        </ul>
      )}
      {seccion.despues?.map((parrafo) => (
        <p key={parrafo} className="mt-2 text-sm leading-relaxed text-slate-300">
          {parrafo}
        </p>
      ))}
    </section>
  )
}
