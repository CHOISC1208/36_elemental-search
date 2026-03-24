declare module 'react-simple-maps' {
  import { ComponentProps, ReactNode, CSSProperties } from 'react'

  interface ProjectionConfig {
    center?: [number, number]
    scale?: number
    rotate?: [number, number, number]
    parallels?: [number, number]
  }

  interface ComposableMapProps {
    projection?: string
    projectionConfig?: ProjectionConfig
    width?: number
    height?: number
    style?: CSSProperties
    children?: ReactNode
  }

  interface GeographiesProps {
    geography: string | object
    children: (args: { geographies: Geography[] }) => ReactNode
  }

  interface Geography {
    rsmKey: string
    properties: Record<string, unknown>
    [key: string]: unknown
  }

  interface GeographyStyle {
    fill?: string
    stroke?: string
    strokeWidth?: number
    outline?: string
    cursor?: string
  }

  interface GeographyProps {
    geography: Geography
    style?: {
      default?: GeographyStyle
      hover?: GeographyStyle
      pressed?: GeographyStyle
    }
    onClick?: (geo: Geography) => void
    onMouseEnter?: (geo: Geography) => void
    onMouseLeave?: (geo: Geography) => void
    [key: string]: unknown
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element
  export function Geographies(props: GeographiesProps): JSX.Element
  export function Geography(props: GeographyProps): JSX.Element
  interface MoveEvent {
    coordinates: [number, number]
    zoom: number
    x: number
    y: number
    k: number
  }

  export function ZoomableGroup(props: {
    center?: [number, number]
    zoom?: number
    minZoom?: number
    maxZoom?: number
    onMove?: (event: MoveEvent) => void
    onMoveEnd?: (event: MoveEvent) => void
    children?: ReactNode
  }): JSX.Element
  export function Marker(props: { coordinates: [number, number]; children?: ReactNode }): JSX.Element
  export function Annotation(props: object): JSX.Element
}
