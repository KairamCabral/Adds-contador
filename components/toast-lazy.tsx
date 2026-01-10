'use client'

import dynamic from 'next/dynamic'

export default dynamic(
  () => import('./toast').then(mod => mod.ToastContainer),
  {
    ssr: false,
    loading: () => null
  }
)
