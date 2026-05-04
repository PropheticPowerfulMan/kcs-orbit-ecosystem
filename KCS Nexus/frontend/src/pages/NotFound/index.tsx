import { Link } from 'react-router-dom'

const NotFoundPage = () => {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-white px-6 dark:bg-kcs-blue-950">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-kcs-gold-600 dark:text-kcs-gold-400">404</p>
        <h1 className="mt-4 font-display text-5xl font-bold text-kcs-blue-900 dark:text-white">Page not found</h1>
        <p className="mt-4 text-gray-500 dark:text-gray-400">
          The page you requested does not exist or has been moved. Return to the main KCS Nexus experience.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/" className="btn-primary">Go Home</Link>
          <Link to="/contact" className="btn-gold">Contact Support</Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
