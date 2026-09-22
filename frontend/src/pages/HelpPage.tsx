import React, { useState } from 'react'
import { ChevronDown, CircleHelp } from 'lucide-react'
import { cn } from '../utils/cn'
import { Card } from '../components/ui/Card'
import { ICON_16 } from '../utils/iconSize'

type HelpSection = {
  id: string
  title: string
  body: string[]
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'overview',
    title: 'Главная (Обзор)',
    body: [
      'Сводка доходов и расходов за выбранный период, баланс и графики.',
      'Блок «Скоро к оплате» показывает ближайшие операции из планировщика.',
      'Кнопка «+» — быстрое добавление дохода или расхода.'
    ]
  },
  {
    id: 'accounts',
    title: 'Счета',
    body: [
      'Счета — наличные, карты, накопления и другие кошельки.',
      'У каждого счёта своя валюта, иконка и начальный баланс.',
      'Ненужный счёт можно архивировать — он скроется из обычных списков.'
    ]
  },
  {
    id: 'categories',
    title: 'Категории',
    body: [
      'Категории доходов и расходов можно строить деревом: родитель и подкатегории.',
      'В фильтрах и формах список идёт по алфавиту с учётом вложенности.'
    ]
  },
  {
    id: 'transactions',
    title: 'Транзакции',
    body: [
      'Доходы и расходы: сумма, дата, счёт, категория, теги и примечание.',
      'Фильтры по периоду, счёту, категории и типу. Без дат поиск идёт по всем операциям.',
      'Дату удобно выбирать из календаря; сумму с нулём можно сразу перезаписать.'
    ]
  },
  {
    id: 'transfers',
    title: 'Переводы',
    body: [
      'Перевод денег между своими счетами. Можно указать комиссию и примечание.',
      'Отмена перевода удаляет и сам перевод, и связанные операции по балансу.'
    ]
  },
  {
    id: 'scheduled',
    title: 'Планировщик',
    body: [
      'Регулярные операции: день, неделя, месяц и другие периоды.',
      'Ближайшие платежи видны на главной в блоке «Скоро к оплате».'
    ]
  },
  {
    id: 'contacts-debts',
    title: 'Контакты и долги',
    body: [
      'Контакты — люди, с которыми вы ведёте долги.',
      'Долг может быть «я должен» или «мне должны».',
      '«Погасить» уменьшает остаток, «Увеличить долг» — добавляет сумму.',
      'При погашении можно создать связанную транзакцию по выбранному счёту.',
      'В карточке контакта — общая история долгов и платежей.'
    ]
  },
  {
    id: 'reports',
    title: 'Отчёты',
    body: [
      'Сводка за период, разбивка по категориям, сравнение периодов и топ операций.',
      'Клик по категории в отчёте открывает список связанных транзакций.',
      'Отсюда же можно сделать резервную копию данных (JSON).'
    ]
  },
  {
    id: 'settings',
    title: 'Настройки',
    body: [
      'Имя, валюта по умолчанию, тема оформления и смена пароля.',
      'Автобэкап и (в поддерживаемых браузерах на ПК) папка для сохранения копий.',
      'Активные сессии — можно завершить вход на другом устройстве.',
      'Удаление аккаунта необратимо: все ваши данные будут стёрты.'
    ]
  },
  {
    id: 'tips',
    title: 'Полезные советы',
    body: [
      'Данные привязаны к вашему аккаунту — на телефоне и в браузере будет одно и то же.',
      'Периодически делайте бэкап в настройках или отчётах.',
      'Веб-версия обновляется сама после деплоя; Android APK нужно пересобирать вручную.'
    ]
  }
]

/** Страница справки по разделам приложения */
const HelpPage: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(HELP_SECTIONS[0]?.id ?? null)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <CircleHelp className={ICON_16} />
          Справка
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Кратко о разделах приложения и типичных действиях
        </p>
      </div>

      <div className="space-y-3">
        {HELP_SECTIONS.map((section) => {
          const isOpen = openId === section.id

          return (
            <Card key={section.id} className="!p-0 !rounded-xl !shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100">{section.title}</span>
                <ChevronDown
                  className={cn(
                    ICON_16,
                    'text-gray-400 shrink-0 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <ul className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  {section.body.map((line) => (
                    <li
                      key={line}
                      className="text-sm text-gray-600 dark:text-gray-300 pl-3 border-l-2 border-primary-200 dark:border-primary-800"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default HelpPage
