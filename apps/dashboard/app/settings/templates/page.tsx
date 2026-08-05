'use client'

import { useState } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FileText, ScrollText, Download, Building2, User, MapPin, Mail, Phone, DollarSign, Calendar, Clock } from 'lucide-react'

const COMPANY_INFO = {
  name: 'The Broken Wood Inc',
  address: 'Downtown Santa Monica, CA 90402',
  signatory: 'Sammy Abdel',
  title: 'Chief Executive Officer',
  email: 'sammyabdel@thebrokenwood.com',
  phone: '+1 (862) 366-7366',
}

const PAYMENT_VARIABLES = [
  { name: '[BILLING_CYCLE]', desc: 'Weekly, Bi-Weekly, Monthly', icon: Calendar },
  { name: '[PAYMENT_TERMS]', desc: 'Net 7, Net 15, Net 30', icon: Clock },
  { name: '[PAYOUT_DISPLAY]', desc: 'Per-call payout amount', icon: DollarSign },
]

const OTHER_VARIABLES = [
  { name: '[VENDOR_NAME]', desc: 'Company name' },
  { name: '[CONTACT_NAME]', desc: 'Contact person' },
  { name: '[CAMPAIGN_NAME]', desc: 'Campaign title' },
  { name: '[MIN_DURATION]', desc: 'Min call seconds' },
  { name: '[GEOGRAPHIC_FOCUS]', desc: 'Target regions' },
]

const IO_TEMPLATE = `AFFILIATE INSERTION ORDER

This Insertion Order ("IO") is entered into between The Broken Wood Inc
("Company") and [VENDOR_NAME] ("Affiliate"), and is subject to the terms
below. This IO is effective as of the date of last signature.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CAMPAIGN SPECIFICATIONS

   Campaign:          [CAMPAIGN_NAME]
   Industry:          [CAMPAIGN_INDUSTRY]
   Call Type:         [CALL_TYPE]
   Payout:            [PAYOUT_DISPLAY]
   Min Duration:      [MIN_DURATION] seconds
   Geographic Focus:  [GEOGRAPHIC_FOCUS]
   Requirements:      [REQUIREMENTS]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PAYMENT TERMS

   Billing Cycle:     [BILLING_CYCLE]
   Payment Terms:     [PAYMENT_TERMS]

   • Affiliate must maintain current and valid payment information on file.
   • Company reserves the right to withhold payment pending quality review.
   • Disputed calls will be reviewed within 10 business days.
   • Company may offset amounts owed against invalid lead chargebacks.
   • Payments under $50 may be held until the next billing cycle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. TRAFFIC REQUIREMENTS

   Allowed:     [ALLOWED_TRAFFIC]
   Restricted:  [RESTRICTED_TRAFFIC]

   Affiliate represents and warrants that all traffic:
   • Is generated through legitimate, compliant marketing channels
   • Does not include robocalls, auto-dialed calls, or pre-recorded messages
   • Is not incentivized (no rewards, gifts, or payments to callers)
   • Does not originate from unauthorized sub-affiliates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. COMPLIANCE

   Affiliate agrees to comply with all applicable laws including:
   • Telephone Consumer Protection Act (TCPA)
   • FCC and FTC regulations
   • State Do-Not-Call (DNC) regulations
   • CAN-SPAM Act
   • All applicable state consumer protection laws

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. INVALID LEADS

   Company may reject leads that are:
   • Generated through fraudulent means
   • Test calls, duplicates, or fabricated information
   • From consumers who did not initiate the call
   • Below minimum call duration
   • Generated using auto-dialers or robocalls

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. TERM & TERMINATION

   This IO continues until terminated by either party with 30 days written
   notice. Company may terminate immediately for material breach.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. GOVERNING LAW

   This IO shall be governed by the laws of the State of California.
   Disputes shall be resolved in Los Angeles County, CA.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SIGNATURES


THE BROKEN WOOD INC

Signature: _______________________________

Name:  Sammy Abdel
Title: Chief Executive Officer
Date:  [COMPANY_SIGN_DATE]



AFFILIATE: [VENDOR_NAME]

Signature: _______________________________

Name:  [CONTACT_NAME]
Title: [CONTACT_TITLE]
Date:  [VENDOR_SIGN_DATE]`

const MSA_TEMPLATE = `LEAD PURCHASE AGREEMENT

This Lead Purchase Agreement ("Agreement") is entered into by and between:

THE BROKEN WOOD INC ("Company")
Downtown Santa Monica, CA 90402

and

[VENDOR_NAME] ("Vendor")
[VENDOR_ADDRESS]

Effective Date: [EFFECTIVE_DATE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PURPOSE

   This Agreement establishes the terms under which Vendor will deliver
   Leads to Company, and Company will purchase qualifying Leads.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DEFINITIONS

   "Lead" - A potential customer contact delivered via approved methods.
   "Qualifying Lead" - A Lead that meets all specifications and passes
   validation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. LEAD DELIVERY

   • Vendor shall deliver Leads per Insertion Order specifications
   • All Leads must be exclusive unless otherwise specified
   • Vendor shall not resell or redistribute Leads

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. LEAD QUALITY STANDARDS

   Vendor warrants that each Lead:
   • Originates from a legitimate consumer request
   • Is generated through compliant marketing practices
   • Contains accurate, verifiable consumer information
   • Has proper consent documentation (TCPA compliance)
   • Is not generated through incentivized or fraudulent means

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. PRICING AND PAYMENT

   • Company pays for Qualifying Leads at Insertion Order rates
   • Payment per the billing cycle specified in the IO
   • Company may withhold/deduct for non-qualifying Leads

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. CONFIDENTIALITY

   Each party agrees to keep confidential all non-public information
   including pricing, business strategies, and customer lists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. TERM AND TERMINATION

   • Effective until terminated with 30 days written notice
   • Immediate termination for material breach
   • Pending payments remain due upon termination

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. GOVERNING LAW

   This Agreement shall be governed by California law. Disputes shall be
   resolved in Los Angeles County, California.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SIGNATURES


THE BROKEN WOOD INC

Signature: _______________________________

Name:  Sammy Abdel
Title: Chief Executive Officer
Date:  _______________________________



VENDOR: [VENDOR_NAME]

Signature: _______________________________

Name:  [CONTACT_NAME]
Title: [CONTACT_TITLE]
Date:  _______________________________`

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState('io')

  const downloadTemplate = (name: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}_template.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DashboardShell>
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Templates</h1>
        <p className="text-muted-foreground mt-1">View and manage IO/MSA templates for vendor agreements</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Company Info & Variables */}
        <div className="space-y-6">
          {/* Company Info Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Authorized Signatory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{COMPANY_INFO.signatory}</p>
                  <p className="text-xs text-muted-foreground">{COMPANY_INFO.title}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-sm border-t pt-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="text-xs">{COMPANY_INFO.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-xs">{COMPANY_INFO.address}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="text-xs">{COMPANY_INFO.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="text-xs">{COMPANY_INFO.phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Variables - Highlighted */}
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Payment Variables
              </CardTitle>
              <CardDescription className="text-xs">Customizable per vendor when sending IO</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {PAYMENT_VARIABLES.map((v) => {
                const Icon = v.icon
                return (
                  <div key={v.name} className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-xs font-mono text-green-800 dark:text-green-300">{v.name}</code>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Other Variables */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Other Variables</CardTitle>
              <CardDescription className="text-xs">Auto-filled from vendor/campaign data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {OTHER_VARIABLES.map((v) => (
                  <div key={v.name} className="flex items-center justify-between text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{v.name}</code>
                    <span className="text-xs text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Templates */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="io" className="gap-2">
                <FileText className="h-4 w-4" />
                Insertion Order (IO)
              </TabsTrigger>
              <TabsTrigger value="msa" className="gap-2">
                <ScrollText className="h-4 w-4" />
                Lead Purchase Agreement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="io" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
                  <div>
                    <CardTitle className="text-lg">Insertion Order Template</CardTitle>
                    <CardDescription>Sent when vendors are approved for campaigns</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadTemplate('IO', IO_TEMPLATE)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-slate-950 dark:bg-slate-900 rounded-b-lg">
                    <pre className="p-6 text-sm overflow-x-auto whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto leading-relaxed text-slate-300">
                      {IO_TEMPLATE}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="msa" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
                  <div>
                    <CardTitle className="text-lg">Lead Purchase Agreement Template</CardTitle>
                    <CardDescription>Master agreement sent after IO is signed</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadTemplate('MSA', MSA_TEMPLATE)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="bg-slate-950 dark:bg-slate-900 rounded-b-lg">
                    <pre className="p-6 text-sm overflow-x-auto whitespace-pre-wrap font-mono max-h-[600px] overflow-y-auto leading-relaxed text-slate-300">
                      {MSA_TEMPLATE}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </DashboardShell>
  )
}
