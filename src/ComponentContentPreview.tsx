import { useState } from 'react'
import { Icon } from './components/Icon'
import { Input, Select } from './components/FormControls'
import { InfoRow } from './components/InfoRow'
import { TypographyGroup } from './components/TypographyGroup'
import { ErrorNotification } from './components/ErrorNotification'
import { SuccessNotification } from './components/SuccessNotification'
import { FormPanelNote } from './components/FormPanel'

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
        <InputUsage context="Создание и изменение города"><Input label="Ссылка Google Maps" icon={<Icon name="link" />} type="url" /></InputUsage>
        <InputUsage context="Транспорт · место отправления и место прибытия"><Input icon={<Icon name="pin-transport" />} aria-label="Ссылка Google Maps места отправления" placeholder="Ссылка Google Maps" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Отель · адрес в Google Maps"><Input icon={<Icon name="pin-home" />} aria-label="Ссылка на отель в Google Maps" placeholder="Ссылка Google Maps" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Приглашение участника"><Input aria-label="Активная ссылка приглашения" icon={<Icon name="link" />} readOnly value="https://travel.example/invite/example" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
        <InputUsage context="Публичная ссылка на просмотр поездки"><Input icon={<Icon name="link" />} aria-label="Ссылка для просмотра" readOnly value="https://travel.example/view/example" trailingIcon={<Icon name="content-copy" />} /></InputUsage>
      </Example>
      <Example title="Названия мест, города и поездки">
        <InputUsage context="Создание и изменение поездки"><Input label="Название поездки" icon={<Icon name="book" />} placeholder="Например, Япония" /></InputUsage>
        <InputUsage context="Добавление и измение города"><Input label="Название города" icon={<Icon name="planet" />} placeholder="Например, Осака" /></InputUsage>
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

    <Group id="content-field-errors" title="Ошибки полей" description="Точные тексты, которые показываем рядом с инпутом или селектом" className="kit-content-field-errors">
      <Example title="Аккаунт">
        <InputUsage context="Ссылка не содержит пригласительный токен"><Input icon={<Icon name="link" />} value="https://travel.example" readOnly error="Неправильная ссылка" /></InputUsage>
        <InputUsage context="Email не прошёл проверку"><Input type="email" value="user@" readOnly error="Такая почта не зарегистрирована" /></InputUsage>
        <InputUsage context="Имя не заполнено"><Input label="Имя" readOnly error="Нужно ввести имя" /></InputUsage>
        <InputUsage context="Создание или изменение пароля · меньше 8 символов"><Input type="password" value="12345" readOnly error="В пароле должно быть не меньше 8 символов" /></InputUsage>
        <InputUsage context="Вход · пароль не совпал"><Input type="password" value="••••••••" readOnly error="Неправильный пароль" /></InputUsage>
        <InputUsage context="Создание или изменение пароля · больше 256 символов"><Input type="password" value="••••••••" readOnly error="В пароле должно быть меньше 256 символов" /></InputUsage>
        <InputUsage context="Email уже занят"><Input type="email" value="user@example.com" readOnly error="Аккаунт с такой почтой уже есть" /></InputUsage>
      </Example>
      <Example title="Поездка и город">
        <InputUsage context="Название поездки не заполнено"><Input label="Название поездки" icon={<Icon name="book" />} readOnly error="Нужно ввести название поезки" /></InputUsage>
        <InputUsage context="Подтверждение удаления не совпадает"><Input label="Название поездки" value="Япон" readOnly error="Такой поездки не существует" /></InputUsage>
        <InputUsage context="Подтверждение удаления города не совпадает"><Input label="Название города" value="Оса" readOnly error="Такого города не существует" /></InputUsage>
        <InputUsage context="Дата начала поездки не выбрана"><Select type="date" label="Начало" placeholder="Выбрать дату" value="" error="Нужно выбрать дату начала"><option value="" disabled>Выбрать дату</option></Select></InputUsage>
        <InputUsage context="Дата окончания поездки не выбрана"><Select type="date" label="Окончание" placeholder="Выбрать дату" value="" error="Нужно выбрать дату окончания"><option value="" disabled>Выбрать дату</option></Select></InputUsage>
        <InputUsage context="Дата окончания раньше даты начала"><Select type="date" label="Окончание" value="3 октября" error="Дата окончания не может быть раньше даты начала"><option>3 октября</option></Select></InputUsage>
        <InputUsage context="Название города не заполнено"><Input label="Название города" icon={<Icon name="planet" />} readOnly error="Нужно ввести название города" /></InputUsage>
        <InputUsage context="Дата прибытия в город не выбрана"><Select type="date" label="Прибытие" placeholder="Приедем" value="" error="Нужно выбрать дату прибытия"><option value="" disabled>Приедем</option></Select></InputUsage>
        <InputUsage context="Дата отъезда из города не выбрана"><Select type="date" label="Отъезд" placeholder="Уедем" value="" error="Нужно выбрать дату отъезда"><option value="" disabled>Уедем</option></Select></InputUsage>
        <InputUsage context="Отъезд раньше прибытия"><Select type="date" label="Отъезд" value="3 октября" error="Дата отъезда не может быть раньше даты прибытия"><option>3 октября</option></Select></InputUsage>
        <InputUsage context="Время отъезда раньше времени прибытия в один день"><Select type="time" label="Отъезд" value="morning" displayValue="Утро" error="Время отъезда не может быть раньше времени прибытия"><option value="morning">Утро</option></Select></InputUsage>
      </Example>
      <Example title="Места">
        <InputUsage context="Название места не заполнено"><Input label="Название места" icon={<Icon name="book" />} readOnly error="Нужно ввести название места" /></InputUsage>
      </Example>
    </Group>

    <Group id="content-info-row-errors" title="Ошибки Info Row" description="Точные тексты, которые показываем под строками городов, изображений и документов" className="kit-content-info-row-errors">
      <Example title="Города">
        <InputUsage context="Город находится вне нового диапазона поездки"><InfoRow image={image} imageAlt="Осака" title="Осака" titleStyle="text" subtitle="7–10 окт · 2 дня" error="Даты города находятся вне дат поездки" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Изменить город' }]} /></InputUsage>
      </Example>
      <Example title="Изображения">
        <InputUsage context="Для фото выбран неподходящий формат"><InfoRow title="Фото города" titleStyle="text" subtitle="В формате JPG, PNG, WEBP до 15 МБ" error="Проверьте формат файла" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото' }]} /></InputUsage>
        <InputUsage context="Файл превышает допустимый размер"><InfoRow title="Фоновое фото" titleStyle="text" subtitle="В формате JPG, PNG, WEBP до 15 МБ" error="Слишком тяжёлый файл" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото' }]} /></InputUsage>
      </Example>
      <Example title="Документы">
        <InputUsage context="Билет или бронь не загрузились"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" imageDimmed title="Прикрепить билет" titleStyle="text" subtitle="Лучше в PDF формате" error="Попробуйте загрузить ещё раз" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет' }]} /></InputUsage>
        <InputUsage context="Документ не открылся или не скачался"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет MU-248" titleStyle="text" subtitle="Torch · 27 сентября, 14:30" error="Попробуйте скачать ещё раз" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет' }]} /></InputUsage>
        <InputUsage context="Участник удаляет чужой файл"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет MU-248" titleStyle="text" subtitle="Torch · 27 сентября, 14:30" error={'Удалить файл может его автор или\u00a0владелец\u00a0поездки'} actionTheme="secondary" actions={[{ icon: <Icon name="delete-forever" />, label: 'Удалить билет' }]} /></InputUsage>
      </Example>
    </Group>

    <Group id="content-success-notifications" title="Успешные уведомления" description="Подтверждения успешно завершённых действий" className="kit-content-success-notifications">
      <Example title="Сохранение данных">
        <InputUsage context="Поездка и связанные данные успешно сохранены"><div className="kit-content-notification-example"><SuccessNotification onClose={() => undefined} /></div></InputUsage>
      </Example>
    </Group>

    <Group id="content-error-notifications" title="Уведомления об ошибках" description="Общие ошибки действий, которые нельзя привязать к конкретному полю" className="kit-content-error-notifications">
      <Example title="Данные и действия">
        <InputUsage context="Сохранение поездки, города, места, отеля или транспорта; смена дня и порядка места"><div className="kit-content-notification-example"><ErrorNotification title="Эх, не сохраняется" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
        <InputUsage context="Новые даты поездки не включают один или несколько городов"><div className="kit-content-notification-example"><ErrorNotification title="Эх, не сохраняется" message="Проверьте даты городов" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Добавление или перенос места в день, где оно уже есть"><div className="kit-content-notification-example"><ErrorNotification title="Дважды никак в один день" message="Выберите другую дату для точки" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Загрузка или обновление данных"><div className="kit-content-notification-example"><ErrorNotification title="Эх, не загружается" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
        <InputUsage context="Удаление места, файла, участника или поездки не выполнилось"><div className="kit-content-notification-example"><ErrorNotification title="Эх, не удаляется" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
        <InputUsage context="Объект уже удалён, данные поездки изменились или ответственный больше не состоит в поездке"><div className="kit-content-notification-example"><ErrorNotification title="Кажется, данные устарели" message="Обновитесь до последней версии поездки" retryLabel="Обновить данные" actionIcon="refresh" onRetry={() => undefined} /></div></InputUsage>
      </Example>
      <Example title="Файлы и поездки">
        <InputUsage context="Загрузка файла или импорт отправлены без выбранного файла"><div className="kit-content-notification-example"><ErrorNotification title="Кажется, вы не выбрали файл" message="Нужно выбрать" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Файл импорта повреждён"><div className="kit-content-notification-example"><ErrorNotification title="Кажется, файл повреждён" message="Попробуйте загрузить другой файл" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Формат импорта не поддерживается"><div className="kit-content-notification-example"><ErrorNotification title="Не тот формат файла" message="Нужен формат .travelspace" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="В импортируемой поездке некорректные данные"><div className="kit-content-notification-example"><ErrorNotification title="Эх, поездка не загружается" message="В ней есть некорректные данные" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Неизвестная ошибка импорта"><div className="kit-content-notification-example"><ErrorNotification title="Эх, поездка не загружается" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
        <InputUsage context="Архив импортируемой поездки больше допустимого размера"><div className="kit-content-notification-example"><ErrorNotification title="Какой огромный файл" message="Должен быть до 200 МБ" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Экспорт поездки"><div className="kit-content-notification-example"><ErrorNotification title="Эх, поездка не скачивается" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
      </Example>
      <Example title="Аватар">
        <InputUsage context="Для аватара выбран файл неподходящего формата"><div className="kit-content-notification-example"><ErrorNotification title="Кажется, это не картинка" message="Нужно в формате JPG, PNG или WEBP" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Файл аватара больше 15 МБ"><div className="kit-content-notification-example"><ErrorNotification title="Какой огромный файл" message="Должен быть до 15 МБ" onClose={() => undefined} /></div></InputUsage>
        <InputUsage context="Аватар не загрузился из-за ошибки сервера или сети"><div className="kit-content-notification-example"><ErrorNotification title="Эх, файл не загрузился" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
      </Example>
      <Example title="Нет прав">
        <InputUsage context="Любое действие после исключения пользователя из поездки"><div className="kit-content-notification-example"><ErrorNotification title="Нет доступа к поездке" message="Обратитесь к её владельцу" onClose={() => undefined} /></div></InputUsage>
      </Example>
      <Example title="Приглашение и общая ошибка">
        <InputUsage context="Приглашение корректное, но присоединиться не получилось"><div className="kit-content-notification-example"><ErrorNotification title="Ох, не присоединяется" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
        <InputUsage context="Неизвестная общая ошибка"><div className="kit-content-notification-example"><ErrorNotification title="Ох, что-то отвалилось" message="Попробуйте ещё раз" onClose={() => undefined} onRetry={() => undefined} /></div></InputUsage>
      </Example>
    </Group>

    <Group id="content-system-errors" title="Системные ошибки" description="Состояния целого экрана или раздела, когда ошибку нельзя привязать к действию" className="kit-content-system-errors">
      <Example title="Загрузка приложения">
        <InputUsage context="Публичная ссылка ведёт на удалённую или несуществующую поездку"><p className="form-hint app-error">Поездка не найдена</p></InputUsage>
        <InputUsage context="Публичную поездку не удалось открыть"><p className="form-hint app-error">Не удалось открыть поездку</p></InputUsage>
        <InputUsage context="Не загрузился аккаунт"><p className="form-hint app-error">Не удалось открыть аккаунт</p></InputUsage>
        <InputUsage context="Автоматическое принятие приглашения не сработало"><p className="form-hint app-error">Не удалось принять приглашение</p></InputUsage>
      </Example>
      <Example title="Раздел поездки">
        <InputUsage context="Список участников не загрузился"><FormPanelNote centered>Не удалось загрузить список участников.</FormPanelNote></InputUsage>
      </Example>
    </Group>

    <Group id="content-info-rows" title="Info Row" description="Строки городов, профиля, файлов, вложений и расходов" className="kit-content-info-rows">
      <Example title="Города">
        <InputUsage context="Изменение поездки · город в маршруте"><InfoRow image={image} imageAlt="Осака" title="Осака" titleStyle="text" subtitle="4–7 окт · 2,5 дня" hoverEffect /></InputUsage>
        <InputUsage context="Дашборд поездки · город с действиями"><InfoRow theme="transparent" image={image} imageAlt="Осака" title="Осака" subtitle="4–7 окт · 2,5 дня" hoverEffect actions={[{ icon: <Icon name="hotel" />, label: 'Отель в Осаке' }, { icon: <Icon name="ticket" />, label: 'Билет в Осаку' }]} /></InputUsage>
      </Example>
      <Example title="Профиль пользователя">
        <InputUsage context="Боковая панель поездки · нижняя карточка"><InfoRow theme="transparent" image={`${import.meta.env.BASE_URL}assets/person-member.png`} imageAlt="Аватар" imageShape="circle" title="Playsty" subtitle="playsty@example.com" /></InputUsage>
        <InputUsage context="Участники поездки"><InfoRow image={`${import.meta.env.BASE_URL}assets/person-member.png`} imageAlt="Аватар" imageShape="circle" title="Playsty" titleStyle="text" subtitle="playsty@example.com" actionTheme="secondary" actions={[{ icon: <Icon name="delete-forever" />, label: 'Удалить участника' }]} /></InputUsage>
      </Example>
      <Example title="Изображения">
        <InputUsage context="Изменение города · загруженное фото"><InfoRow image={image} imageAlt="Фото города" title="Фото города" titleStyle="text" subtitle="autumn-garden.jpg" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Выбрать новое фото' }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото' }]} /></InputUsage>
        <InputUsage context="Изменение города · фото не загружено"><InfoRow title="Фото города" titleStyle="text" subtitle="В формате JPG, PNG, WEBP до 15 МБ" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фото' }]} /></InputUsage>
        <InputUsage context="Изменение поездки · фоновое фото"><InfoRow image={image} imageAlt="Фоновое фото" title="Фоновое фото" titleStyle="text" subtitle="autumn-garden.jpg" actionTheme="secondary" actions={[{ icon: <Icon name="edit" />, label: 'Выбрать новое фото' }, { icon: <Icon name="delete-forever" />, label: 'Удалить фото' }]} /></InputUsage>
        <InputUsage context="Изменение поездки · фоновое фото не загружено"><InfoRow title="Фоновое фото" titleStyle="text" subtitle="В формате JPG, PNG, WEBP до 15 МБ" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить фоновое фото' }]} /></InputUsage>
      </Example>
      <Example title="Документы">
        <InputUsage context="Транспорт · загруженный билет"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Билет MU-248" titleStyle="text" subtitle="Torch · 27 сентября, 14:30" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать билет' }, { icon: <Icon name="delete-forever" />, label: 'Удалить билет' }]} /></InputUsage>
        <InputUsage context="Транспорт · билет не загружен"><InfoRow image={`${import.meta.env.BASE_URL}assets/ticket-placeholder.png`} imageAlt="Билет" title="Прикрепить билет" titleStyle="text" subtitle="Лучше в PDF формате" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить билет' }]} /></InputUsage>
        <InputUsage context="Отель · загруженная бронь"><InfoRow image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title="Бронь Hotel Gracery Shinjuku" titleStyle="text" subtitle="Playsty · 27 сентября, 15:10" actionTheme="secondary" actions={[{ icon: <Icon name="download" />, label: 'Скачать бронь' }, { icon: <Icon name="delete-forever" />, label: 'Удалить бронь' }]} /></InputUsage>
        <InputUsage context="Отель · бронь не загружена"><InfoRow image={`${import.meta.env.BASE_URL}assets/hotel-placeholder.png`} imageAlt="Отель" title="Прикрепить бронь" titleStyle="text" subtitle="Лучше в PDF формате" actionTheme="secondary" actions={[{ icon: <Icon name="add-plus" />, label: 'Прикрепить бронь' }]} /></InputUsage>
      </Example>
      <Example title="Расходы">
        <InputUsage context="Расходы · отель"><InfoRow title="Hotel Gracery Shinjuku" titleStyle="text" subtitle="Оплатил Torch" trailing="54 000 ₽" /></InputUsage>
        <InputUsage context="Расходы · транспорт"><InfoRow title="Москва – Осака" titleStyle="text" subtitle="Оплатили Torch, Playsty" trailing="86 400 ₽" /></InputUsage>
        <InputUsage context="Расходы · итог по участнику"><InfoRow image={`${import.meta.env.BASE_URL}assets/person-member.png`} imageAlt="Аватар" imageShape="circle" title="Playsty" titleStyle="text" subtitle="2 платежа" trailing="43 200 ₽" /></InputUsage>
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
