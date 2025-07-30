// @generated automatically by Diesel CLI.

pub mod bronson {
    pub mod sql_types {
        #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "ip_address", schema = "bronson"))]
        pub struct IpAddress;
    }

    diesel::table! {
        bronson.buildings (abbrev) {
            abbrev -> Text,
            name -> Text,
            lsm_name -> Text,
            zone -> Int2,
        }
    }

    diesel::table! {
        bronson.data (key) {
            key -> Text,
            val -> Text,
        }
    }

    diesel::table! {
        bronson.keys (key_id) {
            key_id -> Text,
            val -> Text,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::IpAddress;

        bronson.rooms (name) {
            abbrev -> Text,
            name -> Text,
            checked -> Text,
            needs_checked -> Bool,
            gp -> Bool,
            available -> Bool,
            until -> Text,
            ping_data -> Array<Nullable<IpAddress>>,
            schedule -> Array<Nullable<Text>>,
        }
    }

    diesel::table! {
        bronson.users (username) {
            username -> Text,
            permissions -> Int2,
        }
    }

    diesel::joinable!(rooms -> buildings (abbrev));

    diesel::allow_tables_to_appear_in_same_query!(
        buildings,
        data,
        keys,
        rooms,
        users,
    );
}
