import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Heading,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  User,
  useProductContext,
} from '@forge/react';
import { requestConfluence } from '@forge/bridge';
import { ConfluenceError, describeError, loadSpaceAdmins } from './admins';

// requestConfluence calls the REST API *as the person viewing the page*, so a
// viewer only ever sees what Confluence already lets them see.
async function fetchJson(path) {
  const response = await requestConfluence(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ConfluenceError(response.status, `${response.status} on ${path}`);
  return response.json();
}

const App = () => {
  const context = useProductContext();
  const spaceId = context?.extension?.space?.id;
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (!context) return; // context arrives asynchronously
    let cancelled = false;
    loadSpaceAdmins(spaceId, fetchJson)
      .then((admins) => !cancelled && setState({ status: 'ready', ...admins }))
      .catch((error) => !cancelled && setState({ status: 'error', message: describeError(error) }));
    return () => {
      cancelled = true;
    };
  }, [context, spaceId]);

  if (state.status === 'loading') return <Spinner label="Loading space admins" />;

  if (state.status === 'error') {
    return (
      <SectionMessage appearance="warning" title="Space admins unavailable">
        <Text>{state.message}</Text>
      </SectionMessage>
    );
  }

  const { userIds, groups } = state;
  if (userIds.length === 0 && groups.length === 0) {
    return <Text>No administrators are listed for this space.</Text>;
  }

  return (
    <Stack space="space.100">
      <Heading as="h4">Space admins</Heading>
      {userIds.map((accountId) => (
        <User key={accountId} accountId={accountId} />
      ))}
      {groups.length > 0 && (
        <Text>Also administered by group{groups.length > 1 ? 's' : ''}: {groups.map((g) => g.name).join(', ')}</Text>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
