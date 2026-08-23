export function PortalFooter() {
  return (
    <footer className="bg-[#050505] border-t border-white/[0.06] mt-auto">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} GrovLabs Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-white/40">
            <a href="https://grovlabs.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#c4ff00] transition-colors">
              grovlabs.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
