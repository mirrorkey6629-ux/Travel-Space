export type ProtectedCity = {
  id: string
  updatedAt?: string
  places?: unknown
  files?: unknown
  image?: unknown
  imageUrl?: unknown
  imageFile?: unknown
  imageDeleteId?: unknown
  [key: string]: unknown
}

export type ProtectedTripState = {
  name: string
  startDate: string
  endDate: string
  timeZone: string
  accentColor?: string
  backgroundRemoved?: boolean
  cities: ProtectedCity[]
}

export const protectedDataSignature = (source: ProtectedTripState) => JSON.stringify([
  source.name,
  source.startDate,
  source.endDate,
  source.timeZone,
  source.accentColor,
  Boolean(source.backgroundRemoved),
  ...source.cities.map((city) => {
    const { updatedAt: _updatedAt, places: _places, files: _files, image: _image, imageUrl: _imageUrl, imageFile: _imageFile, imageDeleteId: _imageDeleteId, ...protectedFields } = city
    return JSON.stringify(protectedFields)
  }),
])

export const hasDifferentProtectedData = (remote: ProtectedTripState, local: ProtectedTripState) => protectedDataSignature(remote) !== protectedDataSignature(local)
