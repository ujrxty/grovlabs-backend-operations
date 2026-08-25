import { N2NSigningFlow } from './n2n-signing-flow'

interface Props {
  params: Promise<{ token: string }>
}

export default async function N2NSignPage({ params }: Props) {
  const { token } = await params
  return <N2NSigningFlow token={token} />
}
