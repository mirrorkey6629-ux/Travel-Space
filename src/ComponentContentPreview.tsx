import { useState } from 'react'
import { Icon } from './components/Icon'
import { Input, Select } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'

function Group({ id, title, description, className = '', children }: { id: string; title: string; description: string; className?: string; children: React.ReactNode }) {
  return <section id={id} className={`kit-section kit-content-section glass${className ? ` ${className}` : ''}`}><TypographyGroup className="kit-section-title" headingLevel="h2" title={title} text={description} /><div className="kit-content-grid">{children}</div></section>
}

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="kit-specimen"><header><h3>{title}</h3></header><div className="kit-content-stack">{children}</div></article>
}

function InputUsage({ children, context }: { children: React.ReactNode; context: string }) {
  return <div className="kit-content-control-label"><span>{context}</span>{children}</div>
}

const defaultImages = [
  { file: 'autumn-garden.jpg', title: 'Фон поездки', usage: 'Фон приложения и поездки', shape: 'landscape' },
  { file: 'city-placeholder.png', title: 'Город', usage: 'Город без загруженного фото', shape: 'square' },
  { file: 'ticket-placeholder.png', title: 'Билет', usage: 'Документ билета', shape: 'square' },
  { file: 'hotel-placeholder.png', title: 'Отель', usage: 'Документ брони отеля', shape: 'square' },
  { file: 'person-owner.png', title: 'Владелец', usage: 'Аватар владельца поездки', shape: 'circle' },
  { file: 'person-member.png', title: 'Участник', usage: 'Аватар участника поездки', shape: 'circle' },
] as const

export function ComponentContentPreview() {
  const [assignees, setAssignees] = useState<string[]>(['torch'])
  const [amount, setAmount] = useState(54000)
  const people = [{ value: 'torch', label: 'Torch' }, { value: 'playsty', label: 'Playsty' }]
  const image = `${import.meta.env.BASE_URL}assets/autumn-garden.jpg`

  return <div className="kit-content-preview">
    <Group id="content-inputs" title="Input" description="Поля из форм поездки, города, транспорта и отеля" className="kit-content-inputs">
      <Example title="Ссылки">
        <InputUsage context="Создание и редактирование города"><Input label="Ссылка Google Maps" icon={<Icon name="link" />} type="url" /></InputUsage>
        <InputUsage context="Транспорт · место отправления и место прибытия"><Input icon={<Icon name="pin-transport" />} aria-label="Ссылка Google Maps места отправления" placeholder="Ссылка Google Maps" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Отель · адрес в Google Maps"><Input icon={<Icon name="pin-home" />} aria-label="Ссылка на отель в Google Maps" placeholder="Ссылка Google Maps" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Приглашение участника"><Input aria-label="Активная ссылка приглашения" icon={<Icon name="link" />} readOnly value="https://travel.example/invite/example" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Публичная ссылка на просмотр поездки"><Input icon={<Icon name="link" />} aria-label="Ссылка для просмотра" readOnly value="https://travel.example/view/example" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
      </Example>
      <Example title="Названия мест, города и поездки">
        <InputUsage context="Создание и редактирование поездки"><Input label="Название поездки" icon={<Icon name="book" />} placeholder="Например, Япония" /></InputUsage>
        <InputUsage context="Добавление и редактирование города"><Input label="Название города" icon={<Icon name="planet" />} placeholder="Например, Осака" /></InputUsage>
        <InputUsage context="Транспорт · точка отправления"><Input label="Место отъезда" icon={<Icon name="public" />} defaultValue="Шереметьево (SVO)" /></InputUsage>
        <InputUsage context="Транспорт · точка прибытия"><Input label="Место приезда" icon={<Icon name="public" />} defaultValue="Kansai (KIX)" /></InputUsage>
        <InputUsage context="Отель · название места проживания"><Input icon={<Icon name="hotel" />} aria-label="Название места" placeholder="Название места" /></InputUsage>
      </Example>
      <Example title="Всё остальное">
        <InputUsage context="Транспорт · тип ещё не выбран"><Input aria-label="Название транспорта" icon={<Icon name="book" />} placeholder="Название транспорта" disabled /></InputUsage>
        <InputUsage context="Транспорт · выбран поезд"><Input aria-label="Название и номер поезда" icon={<Icon name="book" />} placeholder="Название и номер поезда" /></InputUsage>
        <InputUsage context="Транспорт · выбран самолёт"><Input aria-label="Номер рейса" icon={<Icon name="book" />} placeholder="Номер рейса" /></InputUsage>
        <InputUsage context="Транспорт · выбран автобус"><Input aria-label="Название и номер автобуса" icon={<Icon name="book" />} placeholder="Название и номер автобуса" /></InputUsage>
        <InputUsage context="Транспорт · выбран корабль"><Input aria-label="Название и номер корабля" icon={<Icon name="book" />} placeholder="Название и номер корабля" /></InputUsage>
      </Example>
      <Example title="Время и оплата">
        <InputUsage context="Отель · время заселения"><Input label="Заселение с" icon={<Icon name="time" />} placeholder="--:--" /></InputUsage>
        <InputUsage context="Отель · время выселения"><Input label="Выселение до" icon={<Icon name="time" />} placeholder="--:--" /></InputUsage>
        <InputUsage context="Транспорт и отель · блок оплаты"><Input content="money" aria-label="Общая сумма в рублях" value={amount} onValueChange={setAmount} /></InputUsage>
      </Example>
    </Group>

    <Group id="content-selects" title="Select" description="Даты, время, тип транспорта и назначение участников" className="kit-content-selects">
      <Example title="Даты">
        <InputUsage context="Поездка · даты ещё не выбраны"><div className="date-summary kit-date-summary-preview"><button type="button">Дата начала</button><span>–</span><button type="button">Дата окончания</button></div></InputUsage>
        <InputUsage context="Поездка · заполненные даты"><div className="date-summary kit-date-summary-preview"><button type="button">4 октября</button><span>–</span><button type="button">15 октября</button><span>· 12 дней</span></div></InputUsage>
        <InputUsage context="Город · прибытие, дата ещё не выбрана"><Select type="date" placeholder="Приедем" icon={<Icon name="calendar-month" />} aria-label="Дата прибытия" defaultValue=""><option>4 октября · Вс</option></Select></InputUsage>
        <InputUsage context="Город · прибытие, заполненное состояние"><Select type="date" icon={<Icon name="calendar-month" />} aria-label="Дата прибытия" defaultValue="4 октября · Вс"><option>4 октября · Вс</option></Select></InputUsage>
        <InputUsage context="Город · отъезд, дата ещё не выбрана"><Select type="date" placeholder="Уедем" icon={<Icon name="calendar-month" />} aria-label="Дата отъезда из города" defaultValue=""><option>7 октября · Ср</option></Select></InputUsage>
        <InputUsage context="Город · отъезд, заполненное состояние"><Select type="date" icon={<Icon name="calendar-month" />} aria-label="Дата отъезда из города" defaultValue="7 октября · Ср"><option>7 октября · Ср</option></Select></InputUsage>
        <InputUsage context="Место на карте · дата посещения"><Select type="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" defaultValue="4 октября · Вс"><option>4 октября · Вс</option><option>5 октября · Пн</option></Select></InputUsage>
        <InputUsage context="Место на карте · без привязки к дате"><Select type="date" icon={<Icon name="calendar-month" />} aria-label="Дата посещения" defaultValue="Без даты"><option>Без даты</option><option>4 октября · Вс</option></Select></InputUsage>
        <InputUsage context="Транспорт · дата отправления"><Select type="date" label="Уедем" icon={<Icon name="calendar-month" />} defaultValue="4 октября · Вс"><option>4 октября · Вс</option></Select></InputUsage>
        <InputUsage context="Транспорт · дата прибытия"><Select type="date" label="Приедем" icon={<Icon name="calendar-month" />} defaultValue="5 октября · Пн"><option>5 октября · Пн</option></Select></InputUsage>
      </Example>
      <Example title="Время и тип транспорта">
        <InputUsage context="Город · время прибытия или отъезда"><Select type="time" icon={<Icon name="time" />} aria-label="Время прибытия" defaultValue="Утро"><option>Утро</option><option>День</option><option>Вечер</option></Select></InputUsage>
        <InputUsage context="Транспорт · тип ещё не выбран"><Select type="time" placeholder="Транспорт" icon={<Icon name="rocket-launch" />} aria-label="Тип транспорта" defaultValue=""><option value="plane">Самолёт</option><option value="train">Поезд</option><option value="bus">Автобус</option><option value="ship">Корабль</option></Select></InputUsage>
        <InputUsage context="Транспорт · тип выбран"><Select type="time" label="Тип транспорта" icon={<Icon name="plane" />} displayValue="Самолёт" aria-label="Тип транспорта" defaultValue="plane"><option value="plane">Самолёт</option><option value="train">Поезд</option><option value="bus">Автобус</option><option value="ship">Корабль</option></Select></InputUsage>
      </Example>
      <Example title="Ответственные">
        <InputUsage context="Пользователь выбран">
        <Select type="assignee" options={people} value={assignees} icon={<Icon name="ticket" />} emptyLabel="Кто покупает билет" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь не выбран">
        <Select type="assignee" options={people} value={[]} icon={<Icon name="ticket" />} emptyLabel="Кто покупает билет" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь выбран">
        <Select type="assignee" options={people} value={assignees} icon={<Icon name="hotel" />} emptyLabel="Кто бронит отель" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь не выбран">
        <Select type="assignee" options={people} value={[]} icon={<Icon name="hotel" />} emptyLabel="Кто бронит отель" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь выбран">
        <Select type="assignee" options={people} value={assignees} icon={<Icon name="barefoot" />} emptyLabel="Кто составляет маршрут" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь не выбран">
        <Select type="assignee" options={people} value={[]} icon={<Icon name="barefoot" />} emptyLabel="Кто составляет маршрут" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь выбран">
        <Select type="assignee" options={people} value={assignees} icon={<Icon name="face" />} emptyLabel="Кто платил" onValueChange={setAssignees} />
        </InputUsage>
        <InputUsage context="Пользователь не выбран">
        <Select type="assignee" options={people} value={[]} icon={<Icon name="face" />} emptyLabel="Кто платил" onValueChange={setAssignees} />
        </InputUsage>
      </Example>
    </Group>

    <Group id="content-info-rows" title="Info Row" description="Строки городов, профиля, файлов, вложений и расходов" className="kit-content-info-rows">
      <Example title="Города">
        <InputUsage context="Редактирование поездки · город в маршруте"><InfoRow image={image} imageAlt="Осака" title="Осака" subtitle="4–7 окт · 2,5 дня" hoverEffect /></InputUsage>
        <InputUsage context="Дашборд поездки · город с действиями"><InfoRow theme="transparent" image={image} imageAlt="Осака" title="Осака" subtitle="4–7 окт · 2,5 дня" hoverEffect actions={[{ icon: <Icon name="hotel" />, label: 'Отель в Осаке' }, { icon: <Icon name="ticket" />, label: 'Билет в Осаку' }]} /></InputUsage>
      </Example>
      <Example title="Профиль пользователя">
        <InputUsage context="Боковая панель поездки · нижняя карточка"><InfoRow theme="transparent" image={`${import.meta.env.BASE_URL}assets/person-member.png`} imageAlt="Аватар" imageShape="circle" title="Playsty" subtitle="playsty@example.com" /></InputUsage>
      </Example>
      <Example title="Изображения">
        <InputUsage context="Редактирование города · загруженное фото"><InfoRow image={image} imageAlt="Фото города" title="Фото города" subtitle="autumn-garden.jpg" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Выбрать новое фото' }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото' }]} /></InputUsage>
        <InputUsage context="Редактирование города · фото не загружено"><InfoRow title="Прикрепить фото города" subtitle="Лучше в вертикальном формате" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото' }]} /></InputUsage>
        <InputUsage context="Редактирование поездки · фоновое фото"><InfoRow image={image} imageAlt="Фоновое фото" title="Фоновое фото" subtitle="autumn-garden.jpg" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Выбрать новое фото' }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото' }]} /></InputUsage>
        <InputUsage context="Редактирование поездки · фоновое фото не загружено"><InfoRow title="Прикрепить фоновое фото" subtitle="В хорошем качестве" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фоновое фото' }]} /></InputUsage>
      </Example>
      <Example title="Документы">
        <InputUsage context="Транспорт · загруженный билет"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет MU-248" subtitle="Torch · 27 сентября, 14:30" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет' }, { icon: <Icon name="delete-forever" />, label: 'Удалить билет' }]} /></InputUsage>
        <InputUsage context="Транспорт · билет не загружен"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Прикрепить билет" subtitle="Лучше в PDF формате" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет' }]} /></InputUsage>
        <InputUsage context="Отель · загруженная бронь"><InfoRow image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title="Бронь Hotel Gracery Shinjuku" subtitle="Playsty · 27 сентября, 15:10" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать бронь' }, { icon: <Icon name="delete-forever" />, label: 'Удалить бронь' }]} /></InputUsage>
        <InputUsage context="Отель · бронь не загружена"><InfoRow image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title="Прикрепить бронь" subtitle="Лучше в PDF формате" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить бронь' }]} /></InputUsage>
      </Example>
      <Example title="Расходы">
        <InputUsage context="Расходы · отель"><InfoRow title="Hotel Gracery Shinjuku" subtitle="Оплатил Torch" trailing="54 000 ₽" /></InputUsage>
        <InputUsage context="Расходы · транспорт"><InfoRow title="Москва – Осака" subtitle="Оплатили Torch, Playsty" trailing="86 400 ₽" /></InputUsage>
        <InputUsage context="Расходы · итог по участнику"><InfoRow image={`${import.meta.env.BASE_URL}assets/person-member.png`} imageAlt="Аватар" imageShape="circle" title="Playsty" subtitle="2 платежа" trailing="43 200 ₽" /></InputUsage>
      </Example>
    </Group>

    <Group id="content-default-images" title="Дефолтные изображения" description="Системные изображения, которые интерфейс подставляет автоматически" className="kit-default-images-section">
      {defaultImages.map((item) => <figure className="kit-default-image-card" key={item.file}>
        <div className={`kit-default-image-preview kit-default-image-${item.shape}`}><img src={`${import.meta.env.BASE_URL}assets/${item.file}`} alt={item.title} /></div>
        <figcaption><span className="kit-default-image-title type-text">{item.title}</span><span className="type-text">{item.usage}</span><code className="type-text">{item.file}</code></figcaption>
      </figure>)}
    </Group>
  </div>
}
