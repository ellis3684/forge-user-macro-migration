import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Heading, SectionMessage, Spinner, Stack, Text, User } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    invoke('getSpaceAdmins')
      .then((result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { status: 'ready', userIds: result.userIds, apps: result.apps, groups: result.groups, accessClasses: result.accessClasses }
            : { status: 'error', message: result.message, httpStatus: result.status },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: "Couldn't load the space admins right now. Try refreshing the page." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return <Spinner label="Loading space admins" />;

  if (state.status === 'error') {
    return (
      <SectionMessage appearance="warning" title="Space admins unavailable">
        <Text>{state.message}</Text>
        {state.httpStatus ? <Text>(HTTP {state.httpStatus})</Text> : null}
      </SectionMessage>
    );
  }

  const { userIds, apps, groups, accessClasses } = state;
  const others = [...groups.map((g) => g.name), ...accessClasses];

  if (userIds.length === 0 && others.length === 0 && apps.length === 0) {
    return <Text>No administrators are listed for this space.</Text>;
  }

  return (
    <Stack space="space.100">
      <Heading as="h4">Space admins</Heading>
      {userIds.map((accountId) => (
        <User key={accountId} accountId={accountId} />
      ))}
      {others.length > 0 && <Text>Also administered by: {others.join(', ')}</Text>}
      {apps.length > 0 && <Text>Apps with admin access: {apps.join(', ')}</Text>}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
