'use client'

import Image from 'next/image'

interface LidVizionIconProps {
  className?: string
  invert?: boolean
}

export default function LidVizionIcon({ className = "w-8 h-8", invert = false }: LidVizionIconProps) {
  return (
    <Image
      src="/Lid Vizion Banner Logo Website-BlackSleek.png"
      alt="Lid Vizion Logo"
      width={100}
      height={100}
      className={className}
      style={{
        objectFit: 'contain',
        filter: invert ? 'brightness(0) invert(1)' : 'none'
      }}
    />
  )
}
