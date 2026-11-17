import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'
import { es } from '@/i18n/es'

/**
 * Funciones que existen en el prototipo pero no en esta versión (mensajes y
 * panel de administración; decisión 0.10, tarea 1.7). No están en el menú;
 * quien entra por la URL ve este aviso dentro del `Layout`.
 */
export default function NoDisponiblePage() {
  return (
    <Card>
      <EmptyState
        icono={<Construction size={22} />}
        titulo={es.noDisponible.titulo}
        descripcion={es.noDisponible.detalle}
        action={
          <Link to="/">
            <Button variante="secundario">{es.noDisponible.volver}</Button>
          </Link>
        }
      />
    </Card>
  )
}
