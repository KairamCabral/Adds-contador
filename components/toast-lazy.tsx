import dynamic from 'next/dynamic'

export default dynamic(() => import('./toast').then(mod => ({
  default: mod.ToastContainer
})), {
  ssr: false,
  loading: () => null
})
