import type { Person } from '../../collab/usePresence';
import styles from './presence.module.css';

const MAX_VISIBLE = 8;

type PresenceListProps = { people: Person[] };

export function PresenceList({ people }: PresenceListProps) {
  const visible = people.slice(0, MAX_VISIBLE);
  const hiddenCount = people.length - visible.length;

  return (
    <div>
      <h2 className={styles.heading}>Here now</h2>
      <ul className={styles.list}>
        {visible.map((person) => (
          <li key={person.clientId} className={styles.item}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: person.color }}
              aria-hidden="true"
            />
            <span className={styles.name}>{person.name}</span>
            {person.isSelf && <span className={styles.you}>you</span>}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && <p className={styles.more}>+{hiddenCount} more</p>}
    </div>
  );
}
