import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Daily',
    short_name: 'Daily',
    lang: 'vi',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5ef',
    theme_color: '#18332f',
    icons: [192, 512].map((size) => ({
      src: `/daily-icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any',
    })),
  }
}
