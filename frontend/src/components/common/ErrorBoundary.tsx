import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '../ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-xl font-bold text-red-600 mb-2">Что-то пошло не так</h2>
          <p className="text-gray-600 mb-4">{this.state.message}</p>
          <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
