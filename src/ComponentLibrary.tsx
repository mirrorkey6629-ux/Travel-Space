import { useState } from 'react'
import { GalaxyBackground, Icon, IconName } from './App'
import { Button, IconButton } from './components/Button'
import { Input, Select } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'
import './component-library.css'

const icons: IconName[] = ['add-circle', 'add-pin', 'add-plus', 'arrow-back', 'attractions', 'calendar-month', 'close', 'delete-forever', 'edit-location', 'edit', 'face', 'file-export', 'image', 'key', 'link', 'pin-home', 'planet', 'time', 'upload-file']

const navigation = [
  { id: 'typography', label: 'Типографика' },
  { id: 'typography-groups', label: 'Типографические группы' },
  { id: 'buttons', label: 'Кнопки' },
  { id: 'fields', label: 'Поля и селекты' },
  { id: 'lists', label: 'Списки и плашки' },
  { id: 'states', label: 'Чекбоксы и состояния' },
  { id: 'glass', label: 'Стеклянные контейнеры' },
  { id: 'icons', label: 'Иконки' },
]

function Specimen({ name, children, className = '' }: { name: string; children: React.ReactNode; className?: string }) {
  return <article className={`kit-specimen ${className}`.trim()}><header><h3>{name}</h3></header><div className="kit-demo">{children}</div></article>
}

function Variant({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={`kit-variant${wide ? ' kit-variant-wide' : ''}`}><span className="kit-variant-label">{label}</span><div className="kit-variant-example">{children}</div></div>
}

function Section({ id, title, description, className = '', children }: { id: string; title: string; description?: string; className?: string; children: React.ReactNode }) {
  return <section id={id} className={`kit-section${className ? ` ${className}` : ''}`}><TypographyGroup className="kit-section-title" headingLevel="h2" title={title} text={description ?? ''} /><div className="kit-grid">{children}</div></section>
}

export default function ComponentLibrary() {
  const [checked, setChecked] = useState(true)
  const [buttonIcons, setButtonIcons] = useState(false)
  const [inputLabel, setInputLabel] = useState(true)
  const [inputIcon, setInputIcon] = useState(false)
  return (
    <main className="component-library">
      <GalaxyBackground />
      <div className="kit-page">
        <aside className="kit-sidebar glass">
          <TypographyGroup className="kit-sidebar-heading" title="Компоненты" text="Travel Space" />
          <nav className="kit-navigation" aria-label="Группы компонентов">
            {navigation.map((item) => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}
          </nav>
          <a className="kit-back-link" href="/travel/"><Icon name="arrow-back" />Вернуться в приложение</a>
        </aside>

        <div className="kit-content">
        <Section id="typography" title="Типографика" description="Единая шкала текста проекта">
          <Specimen name="Head L"><Variant label="32px · Medium"><p className="type-head-l kit-type-line">Название поездки</p></Variant></Specimen>
          <Specimen name="Head M"><Variant label="20px · Medium"><p className="type-head-m kit-type-line">Название города</p></Variant></Specimen>
          <Specimen name="Text"><Variant label="15px · Regular"><p className="kit-type-line">Основной текст и подписи</p></Variant></Specimen>
        </Section>

        <Section id="typography-groups" title="Типографические группы" description="Готовые сочетания заголовков и поясняющего текста">
          <Specimen name="Head L + Text"><Variant label="Gap 8"><TypographyGroup title="Название поездки" text="4–15 октября · 12 дней" /></Variant></Specimen>
          <Specimen name="Head M + Text"><Variant label="Gap 4"><TypographyGroup variant="head-m-text" headingLevel="h3" title="Осака" text="Прибытие" /></Variant></Specimen>
        </Section>

        <Section id="buttons" title="Кнопки" description="Основные действия и компактные контролы">
          <Specimen name="Button"><div className="kit-button-showcase"><label className="kit-toggle"><span>Иконка</span><input type="checkbox" checked={buttonIcons} onChange={(event) => setButtonIcons(event.target.checked)} /><i aria-hidden="true" /></label><div className="kit-button-matrix kit-button-matrix-text"><span /><b>L</b><b>M</b><span>Primary · Default</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Primary · Disabled</span><Button icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><span>Secondary · Default</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined}>Сохранить</Button><span>Secondary · Disabled</span><Button theme="secondary" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button><Button theme="secondary" size="m" icon={buttonIcons ? <Icon name="arrow-back" /> : undefined} disabled>Сохранить</Button></div></div></Specimen>
          <Specimen name="Icon button"><div className="kit-button-matrix kit-button-matrix-icon"><span /><b>L</b><b>M</b><b>S</b><span>Primary · Default</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} aria-label="Primary L" /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} aria-label="Primary M" /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Primary S" /><span>Primary · Disabled</span><IconButton theme="primary" size="l" icon={<Icon name="add-plus" />} aria-label="Primary L disabled" disabled /><IconButton theme="primary" size="m" icon={<Icon name="add-plus" />} aria-label="Primary M disabled" disabled /><IconButton theme="primary" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Primary S disabled" disabled /><span>Secondary · Default</span><IconButton size="l" icon={<Icon name="add-plus" />} aria-label="Secondary L" /><IconButton size="m" icon={<Icon name="add-plus" />} aria-label="Secondary M" /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Secondary S" /><span>Secondary · Disabled</span><IconButton size="l" icon={<Icon name="add-plus" />} aria-label="Secondary L disabled" disabled /><IconButton size="m" icon={<Icon name="add-plus" />} aria-label="Secondary M disabled" disabled /><IconButton size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Secondary S disabled" disabled /><span>Transparent · Default</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} aria-label="Transparent L" /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} aria-label="Transparent M" /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Transparent S" /><span>Transparent · Disabled</span><IconButton theme="transparent" size="l" icon={<Icon name="add-plus" />} aria-label="Transparent L disabled" disabled /><IconButton theme="transparent" size="m" icon={<Icon name="add-plus" />} aria-label="Transparent M disabled" disabled /><IconButton theme="transparent" size="s" icon={<Icon name="add-plus" size={16} />} aria-label="Transparent S disabled" disabled /></div></Specimen>
          <Specimen name="Danger button"><Variant label="Default"><button className="kit-danger"><Icon name="delete-forever" />Удалить</button></Variant></Specimen>
        </Section>

        <Section id="fields" title="Поля и селекты" description="Высота 60px, скругление 16px" className="kit-fields-section">
          <Specimen name="Input" className="kit-input-specimen"><div className="kit-control-toggles"><label className="kit-toggle"><span>Подпись</span><input type="checkbox" checked={inputLabel} onChange={(event) => setInputLabel(event.target.checked)} /><i aria-hidden="true" /></label><label className="kit-toggle"><span>Иконка</span><input type="checkbox" checked={inputIcon} onChange={(event) => setInputIcon(event.target.checked)} /><i aria-hidden="true" /></label></div><div className="kit-input-matrix"><span /><b>Обычная</b><b>Акцентная</b><span>Empty</span><Input label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} placeholder="Название города" /><Input theme="accent" label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} placeholder="Название города" /><span>Filled</span><Input label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} defaultValue="Осака" /><Input theme="accent" label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} defaultValue="Осака" /><span>Disabled</span><Input label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} value="Осака" disabled readOnly /><Input theme="accent" label="Город" showLabel={inputLabel} showIcon={inputIcon} icon={<Icon name="attractions" />} value="Осака" disabled readOnly /></div></Specimen>
          <Specimen name="Select" className="kit-input-specimen"><Variant label="Date"><Select content="date" icon={<Icon name="calendar-month" />} defaultValue="4 октября"><option>4 октября</option><option>5 октября</option></Select></Variant><Variant label="Date · Disabled"><Select content="date" icon={<Icon name="calendar-month" />} disabled><option>4 октября</option></Select></Variant><Variant label="List"><Select content="list" icon={<Icon name="time" />} defaultValue="День"><option>Утро</option><option>День</option><option>Вечер</option></Select></Variant><Variant label="List · Disabled"><Select content="list" icon={<Icon name="time" />} disabled><option>День</option></Select></Variant></Specimen>
        </Section>

        <Section id="lists" title="Списки и плашки" description="Карточки основного интерфейса">
          <Specimen name="City row"><Variant label="Default" wide><button className="city-row"><strong>Осака</strong><span>4–6 окт</span><span>1,5 дня</span></button></Variant><Variant label="Selected" wide><button className="city-row kit-selected"><strong>📌 Киото</strong><span>7–10 окт</span><span>2,5 дня</span></button></Variant></Specimen>
          <Specimen name="Info row">
            <Variant label="Без кнопок" wide><InfoRow title="Кансай" subtitle="Гость · 2–8 ноября" /></Variant>
            <Variant label="1 кнопка · Transparent" wide><InfoRow title="🏨 Твой отель" subtitle="Где будем жить" actions={[{ icon: <Icon name="add-plus" />, label: 'Добавить' }]} /></Variant>
            <Variant label="1 кнопка · Secondary" wide><InfoRow title="Аниме Тур" subtitle="Владелец · 4–15 октября" actionTheme="secondary" actions={[{ icon: <Icon name="file-export" />, label: 'Экспортировать' }]} /></Variant>
            <Variant label="2 кнопки · Transparent" wide><InfoRow title="🚅 Осака — Нара" subtitle="ticket.pdf" actions={[{ icon: <Icon name="edit" />, label: 'Редактировать' }, { icon: <Icon name="delete-forever" />, label: 'Удалить' }]} /></Variant>
            <Variant label="2 кнопки · Secondary" wide><InfoRow title="Аниме Тур" subtitle="Владелец · 4–15 октября" actionTheme="secondary" actions={[{ icon: <Icon name="file-export" />, label: 'Экспортировать' }, { icon: <Icon name="delete-forever" />, label: 'Удалить' }]} /></Variant>
          </Specimen>
          <Specimen name="Day city"><Variant label="Default" wide><TypographyGroup className="day-city" variant="head-m-text" headingLevel="h3" title="Осака" text="День в городе" /></Variant></Specimen>
        </Section>

        <Section id="states" title="Чекбоксы и состояния">
          <Specimen name="Document checkbox"><Variant label="Empty"><button className="kit-check-row" onClick={() => setChecked(!checked)}><span className="document-check" />Не прикреплено</button></Variant><Variant label="Checked"><button className="kit-check-row" onClick={() => setChecked(!checked)}><span className={`document-check${checked ? ' checked' : ''}`} />Прикреплено</button></Variant></Specimen>
          <Specimen name="Status text"><Variant label="Default"><span>Основной текст</span></Variant><Variant label="Muted"><span className="kit-muted">Вспомогательный текст</span></Variant><Variant label="Error"><span className="app-error kit-inline-error">Текст ошибки</span></Variant></Specimen>
        </Section>

        <Section id="glass" title="Стеклянные контейнеры" description="Основные уровни вложенности">
          <Specimen name="Main glass"><Variant label="Default" wide><div className="glass kit-glass-card"><h3>Основная карточка</h3><p>Blur 50px, основной стеклянный фон.</p></div></Variant></Specimen>
          <Specimen name="Soft glass"><Variant label="Default" wide><div className="kit-soft-card"><h3>Вложенная плашка</h3><p>Используется внутри карточек.</p></div></Variant></Specimen>
          <Specimen name="Divider"><Variant label="Default" wide><div className="divider" /></Variant></Specimen>
        </Section>

        <Section id="icons" title="Иконки" description={`${icons.length} иконок · белый цвет · базовый размер 24px`}>
          <div className="kit-icons">{icons.map((name) => <div className="kit-icon-item" key={name}><span><Icon name={name} /></span><code>{name}</code></div>)}</div>
        </Section>
        </div>
      </div>
    </main>
  )
}
