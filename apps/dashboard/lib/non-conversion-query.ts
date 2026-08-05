// Server-side helper to build a Prisma `where` clause from query params
// for the non_conversion_review table.

export function buildNonConversionWhere(params: URLSearchParams): any {
  const where: any = {}

  const date = params.get('date') ?? ''
  const dateFrom = params.get('date_from') ?? ''
  const dateTo = params.get('date_to') ?? ''

  if (date) {
    where.review_date = date
  } else if (dateFrom || dateTo) {
    where.review_date = {}
    if (dateFrom) where.review_date.gte = dateFrom
    if (dateTo) where.review_date.lte = dateTo
  }

  const buyer = params.get('buyer') ?? ''
  const vendor = params.get('vendor') ?? ''
  const campaign = params.get('campaign') ?? ''
  const faultSide = params.get('fault_side') ?? ''
  const outcomeReason = params.get('outcome_reason') ?? ''
  const search = params.get('search') ?? ''

  if (buyer) where.buyer_name = buyer
  if (vendor) where.vendor_name = vendor
  if (campaign) where.campaign_name = campaign
  if (faultSide) where.fault_side = faultSide
  if (outcomeReason) where.outcome_reason = outcomeReason

  if (search) {
    where.OR = [
      { caller_number: { contains: search, mode: 'insensitive' as any } },
      { trackdrive_call_id: { contains: search, mode: 'insensitive' as any } },
      { number_called: { contains: search, mode: 'insensitive' as any } },
    ]
  }

  return where
}
