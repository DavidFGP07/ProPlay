import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import { es } from '@/i18n/es'

/** 404 · Vista publica: responde igual con o sin sesion. */
export default function NoEncontradaPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-md">
        <EmptyState
          icono={<Compass size={22} />}
          titulo={es.noEncontrada.titulo}
          descripcion={es.noEncontrada.detalle}
          action={
            <Link to="/">
              <Button>{es.noEncontrada.volver}</Button>
            </Link>
          }
        />
      </Card>
    </main>
  )
}
