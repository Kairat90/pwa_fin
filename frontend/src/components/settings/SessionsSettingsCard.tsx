import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { MonitorSmartphone, RefreshCw } from 'lucide-react'
import { AuthSessionRow, getErrorMessage, supabaseApi } from '../../api/supabase'
import { formatSessionDeviceLabel, formatSessionIp } from '../../utils/sessionDisplay'
import { ICON_16 } from '../../utils/iconSize'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { LoadingSpinner } from '../common/LoadingSpinner'

function formatSessionTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }

  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/** Список активных сеансов и выход с устройств */
export const SessionsSettingsCard: React.FC = () => {
  const [sessions, setSessions] = useState<AuthSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [revokingOthers, setRevokingOthers] = useState(false)

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      const rows = await supabaseApi.auth.listSessions()
      setSessions(rows)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось загрузить сеансы')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const onRevokeOne = async (session: AuthSessionRow) => {
    if (session.isCurrent) {
      return
    }

    if (!window.confirm('Завершить этот сеанс? На том устройстве потребуется войти снова.')) {
      return
    }

    try {
      setBusyId(session.id)
      await supabaseApi.auth.revokeSession(session.id)
      setSessions((prev) => prev.filter((row) => row.id !== session.id))
      toast.success('Сеанс завершён')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось завершить сеанс')
    } finally {
      setBusyId(null)
    }
  }

  const onRevokeOthers = async () => {
    const others = sessions.filter((s) => !s.isCurrent).length

    if (others === 0) {
      toast.success('Других активных сеансов нет')
      return
    }

    if (
      !window.confirm(
        `Выйти со всех других устройств (${others})? Текущий сеанс останется активным.`
      )
    ) {
      return
    }

    try {
      setRevokingOthers(true)
      const deleted = await supabaseApi.auth.revokeOtherSessions()
      await loadSessions()
      toast.success(
        deleted > 0 ? `Завершено сеансов: ${deleted}` : 'Других активных сеансов не было'
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Не удалось завершить другие сеансы')
    } finally {
      setRevokingOthers(false)
    }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <MonitorSmartphone className={ICON_16} />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Активные сеансы</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Устройства, где выполнен вход в аккаунт
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadSessions()}
          disabled={loading}
          aria-label="Обновить список сеансов"
        >
          <RefreshCw className={ICON_16} />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          Сеансы не найдены. Если ошибка повторяется — выполните SQL-миграцию
          <code className="mx-1 text-xs">20250120_user_sessions.sql</code>
          в Supabase.
        </p>
      ) : (
        <ul className="space-y-3 mb-4">
          {sessions.map((session) => {
            const activity = formatSessionTime(session.refreshedAt || session.updatedAt)
            const ip = formatSessionIp(session.ip)

            return (
              <li
                key={session.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatSessionDeviceLabel(session.userAgent)}
                    </p>
                    {session.isCurrent && (
                      <span className="text-[11px] font-medium uppercase tracking-wide rounded-full bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 px-2 py-0.5">
                        Этот сеанс
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Активность: {activity}
                    {ip ? ` · IP ${ip}` : ''}
                  </p>
                </div>
                {!session.isCurrent && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                    loading={busyId === session.id}
                    onClick={() => void onRevokeOne(session)}
                  >
                    Выйти
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Button
        type="button"
        variant="secondary"
        loading={revokingOthers}
        disabled={loading || otherCount === 0}
        onClick={() => void onRevokeOthers()}
      >
        Выйти с других устройств
        {otherCount > 0 ? ` (${otherCount})` : ''}
      </Button>
    </Card>
  )
}
