import { FileText } from 'lucide-react'

export function PortalFooter() {
  return (
    <footer className="bg-gray-50 border-t border-[#b87333]/10 mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} The Broken Wood Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="https://thebrokenwood.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#b87333] transition-colors">
              thebrokenwood.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
