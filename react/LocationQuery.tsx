import React, { FunctionComponent, useEffect, Fragment } from 'react'
import { useQuery } from 'react-apollo'
import { useProduct } from 'vtex.product-context'
import { ProductContextState } from 'vtex.product-context/react/ProductContextProvider'

import ItemLoader from './Loaders/ItemLoader'
import {
  SimpleLocationContextProvider,
  initialSimpleLocationState,
  useSimpleLocationState,
  useSimpleLocationDispatch,
} from './context/SimpleLocationContext'
import ORDERFORM from './queries/orderForm.gql'
import SIMULATE from './queries/simulate.gql'

const ShippingQuery: FunctionComponent = ({ children }) => {
  const { location } = useSimpleLocationState()
  const skuSelector = useProduct()
  const dispatch = useSimpleLocationDispatch()

  const { selectedItem = null } = skuSelector as Partial<ProductContextState>

  const validVars =
    (location?.postalCode || (location?.lat && location?.long)) &&
    location?.country &&
    selectedItem

  const { data, loading, refetch } = useQuery(SIMULATE, {
    ssr: false,
    skip: !validVars,
    variables: {
      items: [
        {
          quantity: '1',
          id: selectedItem?.itemId,
          seller: selectedItem?.sellers?.[0]?.sellerId,
        },
      ],
      postalCode: location?.postalCode,
      geoCoordinates:
        !!location.long && !!location.lat
          ? [location.long, location.lat]
          : null,
      country: location?.country,
    },
  })

  useEffect(() => {
    if (!data?.shipping?.logisticsInfo[0]?.slas?.length) return

    const slaList = data?.shipping?.logisticsInfo.reduce(
      (slas: string[], info: any) => [...slas, ...info.slas],
      []
    )

    const pickupSlas = slaList.filter((sla: SLA) => {
      return !!sla.pickupStoreInfo.address
    })

    const shippingSlas = slaList.filter((sla: SLA) => {
      return !sla.pickupStoreInfo?.address
    })

    dispatch({
      type: 'SET_SLAS',
      args: {
        pickupSlas,
        shippingSlas,
      },
    })
  }, [data, dispatch])

  useEffect(() => {
    refetch()
  }, [location, refetch])

  if (loading) return <ItemLoader />

  return <Fragment>{children}</Fragment>
}

const LocationQueryInner: FunctionComponent = ({ children }) => {
  const { data, refetch } = useQuery(ORDERFORM, { ssr: false })
  const dispatch = useSimpleLocationDispatch()

  useEffect(() => {
    const handleLocationUpdated = () => refetch()

    window.addEventListener('locationUpdated', handleLocationUpdated)

    return () => {
      window.removeEventListener('locationUpdated', handleLocationUpdated)
    }
  }, [refetch])

  useEffect(() => {
    if (!data?.orderForm?.shippingData?.address) return
    const {
      postalCode = '',
      country = '',
      geoCoordinates = [],
    } = data.orderForm.shippingData.address

    if (!country || (!postalCode && geoCoordinates.length !== 2)) return

    dispatch({
      type: 'SET_LOCATION',
      args: {
        location: {
          postalCode,
          country,
          lat:
            geoCoordinates.length !== 0 ? geoCoordinates[1].toString() : null,
          long:
            geoCoordinates.length !== 0 ? geoCoordinates[0].toString() : null,
        },
      },
    })
  }, [data, dispatch])

  if (!data) return null

  return <Fragment>{children}</Fragment>
}

const LocationQuery: FunctionComponent = ({ children }) => {
  return (
    <SimpleLocationContextProvider {...initialSimpleLocationState}>
      <LocationQueryInner>
        <ShippingQuery>{children}</ShippingQuery>
      </LocationQueryInner>
    </SimpleLocationContextProvider>
  )
}

export default LocationQuery
